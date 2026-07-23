from datetime import datetime
from http.client import HTTPException
import json
import socket
from threading import Lock
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import build_opener, HTTPRedirectHandler, Request, urlopen

from flask import Response, render_template, request
from wxcloudrun import app
from wxcloudrun.dao import delete_counterbyid, query_counterbyid, insert_counter, update_counterbyid
from wxcloudrun.model import Counters
from wxcloudrun.response import make_succ_empty_response, make_succ_response, make_err_response


DOUBAN_SEARCH_URLS = {
    'book': 'https://book.douban.com/j/subject_suggest',
    'anime': 'https://movie.douban.com/j/subject_suggest',
    'movie': 'https://movie.douban.com/j/subject_suggest',
    'series': 'https://movie.douban.com/j/subject_suggest',
}
MAX_IMAGE_SIZE = 8 * 1024 * 1024
MAX_SEARCH_SIZE = 1024 * 1024
MAX_DETAIL_SIZE = 2 * 1024 * 1024
DETAIL_CACHE_TTL = 60 * 60
DETAIL_CACHE_LIMIT = 256
detail_cache = {}
detail_cache_lock = Lock()
detail_fetch_lock = Lock()


class NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


image_opener = build_opener(NoRedirectHandler)


def fetch_douban(url, referer):
    upstream_request = Request(url, headers={
        'Accept': 'application/json,image/avif,image/webp,image/*,*/*;q=0.8',
        'Referer': referer,
        'User-Agent': 'Mozilla/5.0 (compatible; Shiyu/1.0)',
    })
    return urlopen(upstream_request, timeout=8)


def fetch_douban_image(url):
    upstream_request = Request(url, headers={
        'Accept': 'image/jpeg,image/png,image/webp,image/gif,*/*;q=0.1',
        'Referer': 'https://www.douban.com/',
        'User-Agent': 'Mozilla/5.0 (compatible; Shiyu/1.0)',
    })
    return image_opener.open(upstream_request, timeout=8)


def fetch_douban_page(url, referer):
    upstream_request = Request(url, headers={
        'Accept': 'application/json',
        'Referer': referer,
        'User-Agent': 'Mozilla/5.0 (compatible; Shiyu/1.0)',
    })
    return urlopen(upstream_request, timeout=8)


def is_douban_image_url(url):
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or '').lower()
        port = parsed.port
    except ValueError:
        return False
    is_allowed_host = hostname == 'doubanio.com' or hostname.endswith('.doubanio.com')
    return parsed.scheme == 'https' and is_allowed_host and port in (None, 443) and not parsed.username


def is_valid_image(content_type, image):
    signatures = {
        'image/jpeg': image.startswith(b'\xff\xd8\xff'),
        'image/png': image.startswith(b'\x89PNG\r\n\x1a\n'),
        'image/gif': image.startswith((b'GIF87a', b'GIF89a')),
        'image/webp': image.startswith(b'RIFF') and image[8:12] == b'WEBP',
    }
    return signatures.get(content_type, False)


def as_text(value):
    return '' if value is None else str(value).strip()


def get_people_names(items, limit=6):
    if not isinstance(items, list):
        return []
    return [as_text(item.get('name')) for item in items if isinstance(item, dict) and item.get('name')][:limit]


@app.route('/')
def index():
    """
    :return: 返回index页面
    """
    return render_template('index.html')


@app.route('/api/health', methods=['GET'])
def health():
    return make_succ_response({'service': 'record-tool', 'status': 'ok'})


@app.route('/api/count', methods=['POST'])
def count():
    """
    :return:计数结果/清除结果
    """

    # 获取请求体参数
    params = request.get_json()

    # 检查action参数
    if 'action' not in params:
        return make_err_response('缺少action参数')

    # 按照不同的action的值，进行不同的操作
    action = params['action']

    # 执行自增操作
    if action == 'inc':
        counter = query_counterbyid(1)
        if counter is None:
            counter = Counters()
            counter.id = 1
            counter.count = 1
            counter.created_at = datetime.now()
            counter.updated_at = datetime.now()
            insert_counter(counter)
        else:
            counter.id = 1
            counter.count += 1
            counter.updated_at = datetime.now()
            update_counterbyid(counter)
        return make_succ_response(counter.count)

    # 执行清0操作
    elif action == 'clear':
        delete_counterbyid(1)
        return make_succ_empty_response()

    # action参数错误
    else:
        return make_err_response('action参数错误')


@app.route('/api/count', methods=['GET'])
def get_count():
    """
    :return: 计数的值
    """
    counter = Counters.query.filter(Counters.id == 1).first()
    return make_succ_response(0) if counter is None else make_succ_response(counter.count)


@app.route('/api/search', methods=['GET'])
def search_douban():
    keyword = request.args.get('q', '').strip()
    category = request.args.get('type', 'movie').strip().lower()
    if not keyword:
        return make_err_response('缺少q参数'), 400
    if len(keyword) > 80:
        return make_err_response('搜索关键词过长'), 400
    if category not in DOUBAN_SEARCH_URLS:
        return make_err_response('type参数错误'), 400

    upstream_url = '{}?{}'.format(DOUBAN_SEARCH_URLS[category], urlencode({'q': keyword}))
    referer = 'https://book.douban.com/' if category == 'book' else 'https://movie.douban.com/'
    try:
        with fetch_douban(upstream_url, referer) as upstream:
            body = upstream.read(MAX_SEARCH_SIZE + 1)
            if len(body) > MAX_SEARCH_SIZE:
                return make_err_response('豆瓣搜索响应过大'), 502
            payload = json.loads(body.decode('utf-8'))
    except (HTTPError, URLError, TimeoutError, socket.timeout, OSError, HTTPException, ValueError, UnicodeDecodeError):
        return make_err_response('豆瓣搜索暂时不可用'), 502

    if not isinstance(payload, list):
        return make_err_response('豆瓣搜索返回了无效数据'), 502

    results = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        source_id = as_text(item.get('id'))
        title = as_text(item.get('title'))
        if not source_id or not title:
            continue
        episode = as_text(item.get('episode'))
        if episode.lower() in ('unknow', 'unknown'):
            episode = ''
        results.append({
            'id': source_id,
            'category': category,
            'title': title,
            'subtitle': as_text(item.get('sub_title')),
            'cover': as_text(item.get('pic') or item.get('img')),
            'year': as_text(item.get('year')),
            'author': as_text(item.get('author_name')),
            'episode': episode,
            'rating': '',
            'description': '',
            'sourceType': as_text(item.get('type')),
            'sourceUrl': as_text(item.get('url')),
        })
    return make_succ_response(results)


@app.route('/api/detail', methods=['GET'])
def get_douban_detail():
    source_id = request.args.get('id', '').strip()
    category = request.args.get('type', 'movie').strip().lower()
    if not source_id.isdigit() or len(source_id) > 20:
        return make_err_response('id参数错误'), 400
    if category not in DOUBAN_SEARCH_URLS:
        return make_err_response('type参数错误'), 400

    detail_type = 'book' if category == 'book' else 'movie'
    cache_key = '{}:{}'.format(detail_type, source_id)
    with detail_cache_lock:
        cached = detail_cache.get(cache_key)
    if cached and time.monotonic() - cached['createdAt'] < DETAIL_CACHE_TTL:
        return make_succ_response(cached['data'])
    if not detail_fetch_lock.acquire(blocking=False):
        return make_err_response('详情请求繁忙，请稍后重试'), 429

    try:
        with detail_cache_lock:
            cached = detail_cache.get(cache_key)
        if cached and time.monotonic() - cached['createdAt'] < DETAIL_CACHE_TTL:
            return make_succ_response(cached['data'])

        page_url = 'https://m.douban.com/rexxar/api/v2/{}/{}'.format(detail_type, source_id)
        referer = 'https://m.douban.com/{}/subject/{}/'.format(detail_type, source_id)
        try:
            with fetch_douban_page(page_url, referer) as upstream:
                body = upstream.read(MAX_DETAIL_SIZE + 1)
                if len(body) > MAX_DETAIL_SIZE:
                    return make_err_response('豆瓣详情响应过大'), 502
                payload = json.loads(body.decode('utf-8'))
        except (HTTPError, URLError, TimeoutError, socket.timeout, OSError, HTTPException, ValueError, UnicodeDecodeError):
            return make_err_response('豆瓣详情暂时不可用'), 502

        if not isinstance(payload, dict):
            return make_err_response('豆瓣详情返回了无效数据'), 502
        rating = payload.get('rating') if isinstance(payload.get('rating'), dict) else {}
        creators = [as_text(item) for item in payload.get('author', [])] if detail_type == 'book' else []
        if detail_type == 'movie':
            creators = get_people_names(payload.get('directors'), 2) + get_people_names(payload.get('actors'), 4)
        detail = {
            'description': as_text(payload.get('intro')),
            'rating': as_text(rating.get('value')),
            'genres': [as_text(item) for item in payload.get('genres', []) if as_text(item)],
            'creators': creators,
            'sourceUrl': as_text(payload.get('url')),
        }
        with detail_cache_lock:
            if len(detail_cache) >= DETAIL_CACHE_LIMIT:
                oldest_key = min(detail_cache, key=lambda key: detail_cache[key]['createdAt'])
                detail_cache.pop(oldest_key, None)
            detail_cache[cache_key] = {'createdAt': time.monotonic(), 'data': detail}
        return make_succ_response(detail)
    finally:
        detail_fetch_lock.release()


@app.route('/api/image', methods=['GET'])
def proxy_douban_image():
    image_url = request.args.get('url', '').strip()
    if not is_douban_image_url(image_url):
        return make_err_response('图片地址不合法'), 400

    try:
        with fetch_douban_image(image_url) as upstream:
            content_type = upstream.headers.get_content_type()
            image = upstream.read(MAX_IMAGE_SIZE + 1)
    except (HTTPError, URLError, TimeoutError, socket.timeout, OSError, HTTPException):
        return make_err_response('豆瓣图片暂时不可用'), 502

    if len(image) > MAX_IMAGE_SIZE:
        return make_err_response('图片文件过大'), 413
    if not is_valid_image(content_type, image):
        return make_err_response('上游内容不是有效图片'), 502
    return Response(image, content_type=content_type, headers={
        'Cache-Control': 'public, max-age=86400',
    })

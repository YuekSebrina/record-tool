import json
import unittest
from io import BytesIO
from unittest.mock import patch

from wxcloudrun import app, views


class FakeHeaders:
    def __init__(self, content_type='application/json'):
        self.content_type = content_type

    def get_content_type(self):
        return self.content_type


class FakeResponse:
    def __init__(self, body, url='https://movie.douban.com/', content_type='application/json'):
        self.body = BytesIO(body)
        self.url = url
        self.headers = FakeHeaders(content_type)

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self, size=-1):
        return self.body.read(size)

    def geturl(self):
        return self.url


class ApiTestCase(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()
        views.trending_cache.clear()
        views.media_classification_cache.clear()

    def test_health(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['data']['status'], 'ok')

    @patch('wxcloudrun.views.classify_media_subject', return_value='movie')
    @patch('wxcloudrun.views.fetch_douban')
    def test_search_normalizes_movie(self, fetch_douban, _classify_media_subject):
        payload = [{
            'id': '1291546',
            'title': '霸王别姬',
            'img': 'https://img1.doubanio.com/poster.jpg',
            'year': '1993',
            'sub_title': '霸王别姬',
            'type': 'movie',
            'url': 'https://movie.douban.com/subject/1291546/',
        }]
        fetch_douban.return_value = FakeResponse(json.dumps(payload).encode('utf-8'))

        response = self.client.get('/api/search?q=霸王别姬&type=movie')

        self.assertEqual(response.status_code, 200)
        result = response.get_json()['data'][0]
        self.assertEqual(result['id'], '1291546')
        self.assertEqual(result['category'], 'movie')
        self.assertEqual(result['cover'], payload[0]['img'])
        self.assertEqual(result['rating'], '')
        self.assertEqual(result['description'], '')

    @patch('wxcloudrun.views.classify_media_subject', return_value='series')
    @patch('wxcloudrun.views.fetch_douban')
    def test_media_search_uses_classified_category(self, fetch_douban, _classify_media_subject):
        payload = [{
            'id': '26928226',
            'title': '知否知否应是绿肥红瘦',
            'img': 'https://img1.doubanio.com/poster.jpg',
            'year': '2018',
            'episode': '78',
            'type': 'movie',
        }]
        fetch_douban.return_value = FakeResponse(json.dumps(payload).encode('utf-8'))

        response = self.client.get('/api/search?q=知否&type=media')

        self.assertEqual(response.status_code, 200)
        data = response.get_json()['data']
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['category'], 'series')

    @patch('wxcloudrun.views.fetch_douban_page')
    def test_media_classifier_prioritizes_animation_genre(self, fetch_douban_page):
        payload = {
            'type': 'tv',
            'is_tv': True,
            'episodes_count': 12,
            'genres': ['剧情', '动画'],
        }
        fetch_douban_page.return_value = FakeResponse(json.dumps(payload).encode('utf-8'))

        category = views.classify_media_subject('37441858', '12')

        self.assertEqual(category, 'anime')

    def test_search_rejects_invalid_category(self):
        response = self.client.get('/api/search?q=test&type=music')
        self.assertEqual(response.status_code, 400)

    @patch('wxcloudrun.views.fetch_douban')
    def test_search_rejects_non_list_payload(self, fetch_douban):
        fetch_douban.return_value = FakeResponse(b'{"error": "blocked"}')
        response = self.client.get('/api/search?q=test&type=movie')
        self.assertEqual(response.status_code, 502)

    @patch('wxcloudrun.views.fetch_douban_page')
    def test_trending_returns_one_normalized_item_per_category(self, fetch_douban_page):
        def response_for_url(url, _referer):
            category = 'book' if 'book_fiction' in url else 'anime' if 'tv_animation' in url else 'series' if 'tv_hot' in url else 'movie'
            item = {
                'id': '{}-id'.format(category),
                'title': '{} title'.format(category),
                'year': ['2026'] if category == 'book' else '2026',
                'rating': {'value': 8.6},
                'card_subtitle': 'Popular now',
            }
            if category == 'book':
                item.update({'cover': {'url': 'https://img1.doubanio.com/book.jpg'}, 'author': ['Author']})
            else:
                item.update({'pic': {'large': 'https://img1.doubanio.com/movie.jpg'}, 'directors': ['Director']})
            payload = {'subject_collection_items': [item]}
            return FakeResponse(json.dumps(payload).encode('utf-8'))

        fetch_douban_page.side_effect = response_for_url
        response = self.client.get('/api/trending')

        self.assertEqual(response.status_code, 200)
        data = response.get_json()['data']
        self.assertEqual([item['category'] for item in data], ['book', 'anime', 'movie', 'series'])
        self.assertEqual(data[0]['author'], 'Author')
        self.assertEqual(data[1]['cover'], 'https://img1.doubanio.com/movie.jpg')
        self.assertEqual(data[2]['rating'], '8.6')

    @patch('wxcloudrun.views.fetch_douban_page')
    def test_detail_extracts_summary_rating_and_genres(self, fetch_douban_page):
        payload = {
            'intro': 'A classic movie.',
            'rating': {'value': 9.6},
            'genres': ['Drama'],
            'directors': [{'name': 'Director'}],
            'actors': [{'name': 'Actor'}],
            'url': 'https://movie.douban.com/subject/1291546/',
        }
        fetch_douban_page.return_value = FakeResponse(json.dumps(payload).encode('utf-8'))

        response = self.client.get('/api/detail?id=1291546&type=movie')

        self.assertEqual(response.status_code, 200)
        data = response.get_json()['data']
        self.assertEqual(data['description'], 'A classic movie.')
        self.assertEqual(data['rating'], '9.6')
        self.assertEqual(data['genres'], ['Drama'])
        self.assertEqual(data['creators'], ['Director', 'Actor'])

    def test_image_rejects_arbitrary_host(self):
        response = self.client.get('/api/image?url=https://example.com/image.jpg')
        self.assertEqual(response.status_code, 400)

    def test_image_rejects_malformed_url(self):
        response = self.client.get('/api/image?url=https://[invalid/image.jpg')
        self.assertEqual(response.status_code, 400)

    @patch('wxcloudrun.views.fetch_douban_image')
    def test_image_returns_upstream_bytes(self, fetch_douban_image):
        fetch_douban_image.return_value = FakeResponse(
            b'\xff\xd8\xffimage-data',
            url='https://img1.doubanio.com/poster.jpg',
            content_type='image/jpeg',
        )

        response = self.client.get('/api/image?url=https://img1.doubanio.com/poster.jpg')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content_type, 'image/jpeg')
        self.assertEqual(response.data, b'\xff\xd8\xffimage-data')

    @patch('wxcloudrun.views.fetch_douban_image')
    def test_image_rejects_invalid_signature(self, fetch_douban_image):
        fetch_douban_image.return_value = FakeResponse(
            b'not-an-image',
            url='https://img1.doubanio.com/poster.jpg',
            content_type='image/jpeg',
        )
        response = self.client.get('/api/image?url=https://img1.doubanio.com/poster.jpg')
        self.assertEqual(response.status_code, 502)


if __name__ == '__main__':
    unittest.main()

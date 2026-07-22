import json
import unittest
from io import BytesIO
from unittest.mock import patch

from wxcloudrun import app


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

    @patch('wxcloudrun.views.fetch_douban')
    def test_search_normalizes_movie(self, fetch_douban):
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

    def test_search_rejects_invalid_category(self):
        response = self.client.get('/api/search?q=test&type=music')
        self.assertEqual(response.status_code, 400)

    @patch('wxcloudrun.views.fetch_douban')
    def test_search_rejects_non_list_payload(self, fetch_douban):
        fetch_douban.return_value = FakeResponse(b'{"error": "blocked"}')
        response = self.client.get('/api/search?q=test&type=movie')
        self.assertEqual(response.status_code, 502)

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

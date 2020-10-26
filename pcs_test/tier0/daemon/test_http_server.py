import logging
from unittest import TestCase
from unittest.mock import Mock, MagicMock

from tornado.httpserver import HTTPServer

from pcs_test.tools.misc import create_setup_patch_mixin

from pcs.daemon import http_server
from pcs.daemon.ssl import PcsdSSL

PORT = 1234
BIND_ADDRESSES = ["addr1", "addr2"]

def addr2sock(addr_list):
    return [f"sock:{addr}" for addr in addr_list]

BIND_SOCKETS = addr2sock(BIND_ADDRESSES)

# Don't write errors to test output.
logging.getLogger("pcs.daemon").setLevel(logging.CRITICAL)

class ManageTest(TestCase, create_setup_patch_mixin(http_server)):
    def setUp(self):
        self.server_list = []
        self.pcsd_ssl = MagicMock(spec_set=PcsdSSL)

        self.setup_patch("HTTPServer", self.HTTPServer)
        # self.setup_patch("PcsdSSL", Mock(return_value=self.pcsd_ssl))
        self.setup_patch("bind_sockets", lambda port, addr: addr2sock([addr]))

        self.app = MagicMock()
        self.https_server_manage = http_server.HttpsServerManage(
            Mock(return_value=self.app),
            PORT,
            BIND_ADDRESSES,
            self.pcsd_ssl,
        )
        self.assertEqual(0, len(self.server_list))
        self.assertFalse(self.https_server_manage.server_is_running)

    def HTTPServer(self, app, ssl_options):
        # pylint: disable=invalid-name
        self.assertEqual(self.app, app)
        self.assertEqual(self.pcsd_ssl.create_context.return_value, ssl_options)
        self.server_list.append(MagicMock(spec_set=HTTPServer))
        return self.server_list[-1]

    def test_starting_and_stopping_new_http_server(self):
        self.https_server_manage.start()
        self.server_list[0].add_sockets.assert_called_once_with(BIND_SOCKETS)
        self.assertTrue(self.https_server_manage.server_is_running)

        self.https_server_manage.stop()
        self.server_list[0].stop.assert_called_once()
        self.assertFalse(self.https_server_manage.server_is_running)

    def test_reload_certs_raises_when_server_not_started(self):
        self.assertRaises(
            http_server.HttpsServerManageException,
            self.https_server_manage.reload_certs,
        )

    def test_reload_certs_exchanges_servers(self):
        self.https_server_manage.start()
        self.https_server_manage.reload_certs()
        self.server_list[0].stop.assert_called_once()
        self.server_list[1].add_sockets.assert_called_once_with(BIND_SOCKETS)
        self.assertTrue(self.https_server_manage.server_is_running)

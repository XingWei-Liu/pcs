import os
from unittest import mock, TestCase

from OpenSSL import SSL

from pcs_test.tools.misc import get_test_resource as rc

from pcs.daemon.ssl import PcsdSSL, CertKeyPair, SSLCertKeyException

SERVER_NAME = "pcsd-daemon"
SSL_OPTIONS = 0
SSL_CIPHERS = "DEFAULT:!RC4"
CERT = rc("daemon.cert")
KEY = rc("daemon.key")

def remove_ssl_files():
    if os.path.exists(CERT):
        os.remove(CERT)
    if os.path.exists(KEY):
        os.remove(KEY)

def damage_ssl_files():
    with open(CERT, "w") as cert:
        cert.write("bad content")
    with open(KEY, "w") as key:
        key.write("bad content")

# various versions of OpenSSL / PyOpenSSL emit different messages
DAMAGED_SSL_FILES_ERRORS_1 = (
    f"Invalid SSL certificate '{CERT}':"
        " 'PEM routines:PEM_read_bio:no start line'"
    ,
    f"Invalid SSL key '{KEY}': 'PEM routines:PEM_read_bio:no start line'"
)
DAMAGED_SSL_FILES_ERRORS_2 = (
    f"Invalid SSL certificate '{CERT}':"
        " 'PEM routines:get_name:no start line'"
    ,
    f"Invalid SSL key '{KEY}': 'PEM routines:get_name:no start line'"
)

class Pair(TestCase):
    def setUp(self):
        remove_ssl_files()
        self.pair = CertKeyPair(CERT, KEY)

    def tearDown(self):
        remove_ssl_files()

    def test_generated_key_check_success(self):
        self.pair.regenerate(SERVER_NAME)
        self.assertEqual(self.pair.check(), [])

    def test_error_if_files_with_bad_content(self):
        damage_ssl_files()
        self.assertTrue(
            self.pair.check()
            in
            [
                list(DAMAGED_SSL_FILES_ERRORS_1),
                list(DAMAGED_SSL_FILES_ERRORS_2),
            ]
        )

    @mock.patch("pcs.daemon.ssl.SSL.Context.use_privatekey")
    def test_error_if_short_key(self, mock_use_key):
        mock_use_key.side_effect = SSL.Error("reason")
        self.pair.regenerate(SERVER_NAME, 1024)
        errors = self.pair.check()
        self.assertEqual(
            errors,
            ["Unable to load SSL certificate and/or key: reason"]
        )

    def test_error_if_cert_does_not_match_key(self):
        self.pair.regenerate(SERVER_NAME)
        with open(KEY, "rb") as key_file:
            key_content = key_file.read()
        self.pair.regenerate(SERVER_NAME)
        with open(KEY, "wb") as key_file:
            key_file.write(key_content)

        errors = self.pair.check()
        self.assertEqual(len(errors), 1)
        self.assertTrue(
            errors[0].startswith("SSL certificate does not match the key:")
        )

class PcsdSSLTest(TestCase):
    def setUp(self):
        remove_ssl_files()
        self.pcsd_ssl = PcsdSSL(
            SERVER_NAME,
            CERT,
            KEY,
            SSL_OPTIONS,
            SSL_CIPHERS
        )

    def tearDown(self):
        remove_ssl_files()

    def test_is_ok_when_ssl_files_does_not_exist(self):
        self.pcsd_ssl.guarantee_valid_certs()

    def test_raises_when_ssl_files_are_damaged(self):
        damage_ssl_files()
        with self.assertRaises(SSLCertKeyException) as ctx_manager:
            self.pcsd_ssl.guarantee_valid_certs()
        self.assertTrue(
            ctx_manager.exception.args
            in
            [DAMAGED_SSL_FILES_ERRORS_1, DAMAGED_SSL_FILES_ERRORS_2]
        )

    def test_context_uses_given_options(self):
        self.pcsd_ssl.guarantee_valid_certs()
        ssl_context = self.pcsd_ssl.create_context()
        self.assertEqual(ssl_context.options, SSL_OPTIONS)

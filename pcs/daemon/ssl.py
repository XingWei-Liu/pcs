import os
import ssl

from OpenSSL import crypto, SSL

from pcs.common.ssl import (
    dump_cert,
    dump_key,
    generate_cert,
    generate_key,
)

def check_cert_key(cert_path, key_path):
    errors = []
    def load(load_ssl_file, label, path):
        try:
            with open(path) as ssl_file:
                return load_ssl_file(crypto.FILETYPE_PEM, ssl_file.read())
        except EnvironmentError as e:
            errors.append(f"Unable to read SSL {label} '{path}': '{e}'")
        except crypto.Error as e:
            msg = ""
            if e.args and e.args[0] and e.args[0][0]:
                msg = f": '{':'.join(e.args[0][0])}'"
            errors.append(f"Invalid SSL {label} '{path}'{msg}")

    cert = load(crypto.load_certificate, "certificate", cert_path)
    key = load(crypto.load_privatekey, "key", key_path)

    if errors:
        return errors

    try:
        context = SSL.Context(SSL.TLSv1_METHOD)
        context.use_privatekey(key)
        context.use_certificate(cert)
    except SSL.Error as e:
        errors.append(f"Unable to load SSL certificate and/or key: {e}")
        # If we cannot load the files, do not confuse users with other error
        # messages.
        return errors
    try:
        context.check_privatekey()
    except (crypto.Error, SSL.Error) as e:
        errors.append(f"SSL certificate does not match the key: {e}")

    return errors

def open_ssl_file_to_rewrite(path):
    return os.fdopen(os.open(path, os.O_CREAT|os.O_WRONLY, 0o600), "wb")

def regenerate_cert_key(server_name, cert_path, key_path, key_length=None):
    key = generate_key(key_length) if key_length else generate_key()
    with open_ssl_file_to_rewrite(cert_path) as cert_file:
        cert_file.write(dump_cert(generate_cert(key, server_name)))
    with open_ssl_file_to_rewrite(key_path) as key_file:
        key_file.write(dump_key(key))

class CertKeyPair:
    def __init__(self, cert_location, key_location):
        self.__cert_location = cert_location
        self.__key_location = key_location

    @property
    def cert_location(self):
        return self.__cert_location

    @property
    def key_location(self):
        return self.__key_location

    def exists(self):
        return (
            os.path.isfile(self.cert_location)
            and
            os.path.isfile(self.key_location)
        )

    def check(self):
        return check_cert_key(self.cert_location, self.key_location)

    def regenerate(self, server_name, key_length=None):
        regenerate_cert_key(
            server_name,
            self.cert_location,
            self.key_location,
            key_length
        )

class SSLCertKeyException(Exception):
    pass

class PcsdSSL:
    def __init__(
        self, server_name, cert_location, key_location, ssl_options, ssl_ciphers
    ):
        self.__server_name = server_name
        self.__ssl_options = ssl_options
        self.__ssl_ciphers = ssl_ciphers
        self.__ck_pair = CertKeyPair(cert_location, key_location)

    def create_context(self) -> ssl.SSLContext:
        # pylint: disable=no-member
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_context.set_ciphers(self.__ssl_ciphers)
        ssl_context.options = self.__ssl_options
        ssl_context.load_cert_chain(
            self.__ck_pair.cert_location,
            self.__ck_pair.key_location
        )
        return ssl_context

    def guarantee_valid_certs(self):
        if not self.__ck_pair.exists():
            self.__ck_pair.regenerate(self.__server_name)
            return

        error_list = self.__ck_pair.check()
        if error_list:
            raise SSLCertKeyException(*error_list)

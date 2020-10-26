#!/usr/bin/python3

import os

from setuptools import setup, Command, find_packages
from setuptools import Distribution
from setuptools.command.install import install


class CleanCommand(Command):
    user_options = []
    def initialize_options(self):
        #pylint: disable=attribute-defined-outside-init
        self.cwd = None
    def finalize_options(self):
        #pylint: disable=attribute-defined-outside-init
        self.cwd = os.getcwd()
    def run(self):
        assert os.getcwd() == self.cwd, 'Must be in package root: %s' % self.cwd
        os.system('rm -rf ./build ./dist ./*.pyc ./*.egg-info')


# The following classes (_ScriptDirSpy, _SomeDir, ScriptDir, PlatLib, PureLib )
# allow to get some directories used by setuptools.
#
# The root reason for introduction `scriptdir` command was the error in
# setuptools, which caused wrong shebang in script files
# (see https://github.com/pypa/setuptools/issues/188 and
# https://bugzilla.redhat.com/1353934). As a workaround the shebang was
# corrected in pcs Makefile, however hardcoded path didn't work on some systems,
# so there was a need to get a reliable path to a script (or bin) directory.
#
# Alternative approach would be correct shebang here in `setup.py`. However, it
# would mean to deal with possible user options (like --root, --prefix,
# --install-lib etc. - or its combinations) consistently with setuptools (and it
# can be patched in some OS).
#
# Later it turn out that it is also necessary to obtain purelib/platlib in
# Makefile.
class _ScriptDirSpy(install):
    """
    Fake install. Its task is to make the some paths accessible to a caller.
    """
    def run(self):
        self.distribution.install_scripts = self.install_scripts
        self.distribution.install_purelib = self.install_purelib
        self.distribution.install_platlib = self.install_platlib

class _SomeDir(Command):
    user_options = []
    def initialize_options(self):
        pass
    def finalize_options(self):
        pass

    def run(self):
        """
        Print desired path (according to subclass) to stdout.

        Unfortunately, setuptools automatically prints "running scriptdir" on
        stdout. So, for example, the output will look like this (for example):
        running scriptdir
        /usr/local/bin

        The shell command `tail` can be used to get only the relevant line:
        `python setup.py scriptdir | tail --lines=1`

        """

        # pylint: disable=no-self-use
        # Create fake install to get a setuptools script directory path.
        dist = Distribution({'cmdclass': {'install': _ScriptDirSpy}})
        dist.dry_run = True
        dist.parse_config_files()
        command = dist.get_command_obj('install')
        command.ensure_finalized()
        command.run()
        print(self.get_dir_from_distribution(dist))

class ScriptDir(_SomeDir):
    def get_dir_from_distribution(self, dist):
        return dist.install_scripts

class PlatLib(_SomeDir):
    def get_dir_from_distribution(self, dist):
        return dist.install_platlib

class PureLib(_SomeDir):
    def get_dir_from_distribution(self, dist):
        return dist.install_purelib

setup(
    name='pcs',
    version='0.10.4',
    description='Pacemaker Configuration System',
    author='Chris Feist',
    author_email='cfeist@redhat.com',
    url='https://github.com/ClusterLabs/pcs',
    packages=find_packages(exclude=["pcs_test", "pcs_test.*"]),
    package_data={'pcs':[
        'bash_completion',
        'pcs.8',
        'pcs',
    ]},
    zip_safe=False,
    entry_points={
        'console_scripts': [
            'pcs = pcs.app:main',
            'pcsd = pcs.run:daemon',
            'pcs_snmp_agent = pcs.run:pcs_snmp_agent',
            'pcs_internal = pcs.pcs_internal:main',
        ],
    },
    cmdclass={
        'clean': CleanCommand,
        'scriptdir': ScriptDir,
        'platlib': PlatLib,
        'purelib': PureLib,
    }
)
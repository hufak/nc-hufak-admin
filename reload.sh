#!/bin/bash
HOME=/www/htdocs/${USER##*\-}
# --recurse-submodules updates submodules that are already checked out; the
# explicit update also initialises ones this checkout has not seen before,
# and --recursive reaches countrycodes, nested inside studentstats2025.
git pull --rebase --recurse-submodules \
	&& git submodule update --init --recursive \
	&& php $HOME/cloud.hufak.net/occ app:disable hufak \
	&& php $HOME/cloud.hufak.net/occ app:enable hufak

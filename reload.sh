#!/bin/bash
HOME=/www/htdocs/${USER##*\-}
# The pull deliberately does not --recurse-submodules: that fails outright on a
# submodule this checkout has never initialised, which would short-circuit the
# && chain before the line that would have fixed it. The explicit update does
# everything that flag would, and initialises new submodules besides;
# --recursive reaches countrycodes, nested inside studentstats2025.
git pull --rebase \
	&& git submodule update --init --recursive \
	&& php $HOME/cloud.hufak.net/occ app:disable hufak \
	&& php $HOME/cloud.hufak.net/occ app:enable hufak

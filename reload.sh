#!/bin/bash
HOME=/www/htdocs/${USER##*\-}
git pull --rebase && php $HOME/cloud.hufak.net/occ app:disable hufak && php $HOME/cloud.hufak.net/occ app:enable hufak

#!/bin/bash
git pull --rebase && occ app:disable hufak && occ app:enable hufak

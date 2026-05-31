## Packaged Camelid Runtime Missing

The installed macOS app bundle can launch without the `camelid` inference binary present inside `/Applications/Cameleer.app/Contents/MacOS/camelid`, causing backend startup to fail with `Inference engine binary missing`.

A manual copy into the app bundle is not an acceptable production fix.

The packaging pipeline must build Camelid, bundle it into the `.app`, mark it executable, and verify it during release checks.

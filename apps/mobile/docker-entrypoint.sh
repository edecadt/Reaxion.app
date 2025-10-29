#!/usr/bin/env bash

set -euo pipefail

export EXPO_NO_AUTO_INSTALL=1
export EXPO_NO_INTERACTIVE=1

OUTPUT_DIR="/shared-apk"
TARGET_APK="${OUTPUT_DIR}/client.apk"
ANDROID_DIR="./android"

rm -f "${TARGET_APK}"

pnpm exec expo prebuild --platform android --no-install

pushd "${ANDROID_DIR}" > /dev/null
./gradlew assembleDebug
popd > /dev/null

APK_SOURCE="$(find "${ANDROID_DIR}/app/build/outputs/apk" -type f -name '*.apk' -print -quit)"

if [ -z "${APK_SOURCE}" ] || [ ! -f "${APK_SOURCE}" ]; then
  echo "APK not produced" >&2
  exit 1
fi

cp "${APK_SOURCE}" "${TARGET_APK}"

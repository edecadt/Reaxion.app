FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     openjdk-17-jdk curl unzip git ca-certificates openssh-client \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
FROM base AS android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="$PATH:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools"
RUN mkdir -p /opt/android-sdk/cmdline-tools \
  && curl -fsSL -o /tmp/cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
  && mkdir -p /opt/android-sdk/cmdline-tools/temp \
  && unzip -q /tmp/cmdtools.zip -d /opt/android-sdk/cmdline-tools/temp \
  && mv /opt/android-sdk/cmdline-tools/temp/cmdline-tools /opt/android-sdk/cmdline-tools/latest \
  && rm -rf /opt/android-sdk/cmdline-tools/temp /tmp/cmdtools.zip \
  && yes | sdkmanager --licenses \
  && sdkmanager \
       "platform-tools" \
       "platforms;android-34" \
       "build-tools;34.0.0"
FROM android-sdk AS pruner
WORKDIR /app
COPY . .
RUN mkdir -p /app/out \
  && (npx turbo prune --scope=mobile --docker --out-dir=/app/out || \
     (echo "turbo prune failed; falling back to full workspace" && \
      mkdir -p /app/out/full && \
      sh -c "tar -cf - . --exclude='./out' | tar -C /app/out/full -xf -" && \
      cp pnpm-lock.yaml /app/out/pnpm-lock.yaml))
FROM android-sdk AS installer
WORKDIR /app
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/full/ ./
RUN pnpm install --frozen-lockfile
FROM installer AS builder
ENV EXPO_NO_TELEMETRY=1
ENV CI=1
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="$PATH:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools"
WORKDIR /app
RUN npx expo prebuild -p android --non-interactive || true
WORKDIR /app/apps/mobile
RUN if [ -d "android" ]; then cd android && ./gradlew assembleDebug; else true; fi

FROM busybox:stable AS runner
VOLUME ["/shared-apk"]
CMD ["sh", "-c", "tail -f /dev/null"]

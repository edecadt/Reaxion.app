FROM node:20-bookworm-slim AS workspace
WORKDIR /app
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    openssh-client \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

COPY . .

RUN pnpm install --frozen-lockfile

FROM node:20-bookworm-slim AS android-builder
WORKDIR /app
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    openjdk-17-jdk \
    curl \
    wget \
    unzip \
    git \
    ca-certificates \
    openssh-client \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

ENV ANDROID_HOME=/sdk
ENV ANDROID_SDK_ROOT=/sdk
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

RUN mkdir -p /sdk/cmdline-tools \
  && curl -fsSL -o /tmp/cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
  && mkdir -p /sdk/cmdline-tools/temp \
  && unzip -q /tmp/cmdtools.zip -d /sdk/cmdline-tools/temp \
  && mv /sdk/cmdline-tools/temp/cmdline-tools /sdk/cmdline-tools/latest \
  && rm -rf /sdk/cmdline-tools/temp /tmp/cmdtools.zip

RUN yes | sdkmanager --licenses --sdk_root=/sdk
RUN sdkmanager --sdk_root=/sdk \
      "platform-tools" \
      "platforms;android-34" \
      "build-tools;34.0.0"

COPY --from=workspace /app /app

ENV EXPO_NO_TELEMETRY=1
ENV CI=1

WORKDIR /app/apps/mobile

RUN pnpm install --filter mobile... --frozen-lockfile

RUN pnpm exec expo prebuild -p android --non-interactive || true

RUN cd android && ./gradlew assembleDebug \
      --no-daemon \
      --max-workers=1 \
      -x lint \
      -x lintVitalRelease

FROM --platform=linux/amd64 busybox:stable AS runner
VOLUME ["/shared-apk"]
WORKDIR /app
COPY --from=android-builder /app/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk ./client.apk

CMD ["sh", "-c", "mkdir -p /shared-apk && if [ -f /app/client.apk ]; then cp /app/client.apk /shared-apk/client.apk && rm -f /shared-apk/placeholder.txt && echo 'client.apk copied to shared-apk'; else echo 'APK build missing - check build logs' > /shared-apk/placeholder.txt; fi; tail -f /dev/null"]

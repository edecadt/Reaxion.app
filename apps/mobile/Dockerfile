FROM reactnativecommunity/react-native-android:latest

RUN npm install -g pnpm@9.0.0 turbo

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm turbo run build --filter=mobile...

WORKDIR /app/apps/mobile

RUN mkdir -p /shared-apk
RUN chmod +x ./docker-entrypoint.sh
CMD ["bash", "./docker-entrypoint.sh"]

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
ENV BUILD_STANDALONE=1
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY public ./public
COPY prisma ./prisma
COPY scripts ./scripts
# next-env.d.ts НЕ копируем — он gitignored и отсутствует в чистом чекауте (клон сервера);
# `next build` генерирует его сам. Копирование ломало on-prem сборку на свежем клоне.
COPY package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs prisma.config.ts ./
RUN npm run build
# pg нужен runtime: scripts/predeploy.mjs делает `import pg` (safe-by-default guard перед
# migrate deploy). В standalone-трейс он не попадает → без этого on-prem контейнер падает
# ERR_MODULE_NOT_FOUND. tsx/prisma — для миграций и сидов, bcryptjs — для сидов.
RUN node -e "const fs=require('fs'); const pkgs=['prisma','tsx','bcryptjs','pg']; const deps=Object.fromEntries(pkgs.map((p)=>[p, require('/app/node_modules/'+p+'/package.json').version])); fs.mkdirSync('/tools',{recursive:true}); fs.writeFileSync('/tools/package.json', JSON.stringify({private:true,dependencies:deps}, null, 2));" \
  && cd /tools \
  && npm install --omit=dev

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=node:node /tools/node_modules ./node_modules
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts ./scripts
RUN ./node_modules/.bin/prisma --version \
  && ./node_modules/.bin/tsx --version \
  && mkdir -p .next/cache \
  && chown -R node:node .next
USER node
EXPOSE 3000
CMD ["sh","-c","node scripts/predeploy.mjs && exec node server.js"]

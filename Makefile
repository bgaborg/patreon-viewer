.PHONY: start dev debug test lint lint-fix encode install

install:
	pnpm install

start:
	pnpm --filter patreon-post-viewer start

dev:
	pnpm --filter patreon-post-viewer dev

debug:
	cd patreon-viewer && pnpm build:client && npx tsx --inspect server.ts

test:
	pnpm -w test

lint:
	pnpm -w lint

lint-fix:
	pnpm -w lint:fix

encode:
	pnpm -w run encode

.PHONY: test check run docker
test:
	npm test
check:
	npm run check
run:
	npm start
docker:
	docker compose up --build

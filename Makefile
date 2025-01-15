docker-build:
	docker build -t seismic-spammer .
docker-run-bash:
	docker run -it --rm --entrypoint /bin/bash seismic-spammer
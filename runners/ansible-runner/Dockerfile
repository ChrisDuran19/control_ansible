FROM python:3.11-slim

RUN pip install ansible ansible-runner

WORKDIR /runner
ENTRYPOINT ["ansible-runner"]

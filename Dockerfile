FROM node:22-alpine

RUN apk add --no-cache git bash

WORKDIR /usr/verivo-project

CMD ["bash", "-c", "cd /usr/verivo-project/Verivo/blockchain && npm install && npx hardhat build; exec bash"]

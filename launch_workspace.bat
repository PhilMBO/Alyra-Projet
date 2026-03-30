@ECHO OFF

CALL config.bat

CD %SCRIPTDIR%

REM Build the Docker image
docker build -t verivo-project .

REM Remove previous container if it exists
docker rm -f ubuntu-verivo 2>NUL

REM Run container with the workspace mounted
REM Ports: 8545=Hardhat node, 3000=Frontend, 3001=Backend
docker run -it --name ubuntu-verivo ^
	-v %SCRIPTDIR%:/usr/verivo-project ^
	-p 8545:8545 ^
	-p 3000:3000 ^
	-p 3001:3001 ^
	verivo-project
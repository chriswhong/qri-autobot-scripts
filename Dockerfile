FROM golang:1.13

#Install git
RUN apt-get update &&\
  apt-get install -y git
RUN git clone https://github.com/qri-io/qri.git
RUN cd qri && go install
#Install Nodejs
RUN apt-get install -y nodejs && apt-get install -y npm

#Set working directory
WORKDIR /go/qri
RUN qri setup
CMD ["qri","connect"]


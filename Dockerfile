FROM node:18.10 as devel

WORKDIR /app
COPY ./package*.json ./
RUN npm install
COPY ./ ./
RUN npm run build

FROM alpine as prod

RUN addgroup -g 1000 -S www && \
  adduser -u 1000 -S www -G www
RUN apk add lighttpd
RUN mkdir -p /var/www/localhost/htdocs && \
  mkdir -p /etc/lighttpd
COPY ./lighttpd.conf /etc/lighttpd/
RUN /usr/sbin/lighttpd -t -f /etc/lighttpd/lighttpd.conf
COPY --from=devel /app/dist/ /var/www/localhost/htdocs/
EXPOSE 80
CMD ["/usr/sbin/lighttpd", "-D", "-f", "/etc/lighttpd/lighttpd.conf"]

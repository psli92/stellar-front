FROM nginx:stable-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/
ARG SK_API_ROOT=v1
RUN printf '%s' "$SK_API_ROOT" | grep -Eq '^[a-zA-Z0-9_-]+$' && sed -i "s/name=\"sk-api-root\" content=\"v1\"/name=\"sk-api-root\" content=\"$SK_API_ROOT\"/" /usr/share/nginx/html/index.html

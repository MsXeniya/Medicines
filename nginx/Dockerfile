FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["nginx", "-t"]

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

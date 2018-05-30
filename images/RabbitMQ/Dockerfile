FROM rabbitmq:3.6.6-management

RUN apt-get update && apt-get -y install unzip

# delayed_message_exchange plugin
ADD https://dl.bintray.com/rabbitmq/community-plugins/3.6.x/rabbitmq_delayed_message_exchange/rabbitmq_delayed_message_exchange-20171215-3.6.x.zip /
RUN unzip /rabbitmq_delayed_message_exchange-20171215-3.6.x.zip -d /usr/lib/rabbitmq/lib/rabbitmq_server-3.6.6/plugins
RUN rabbitmq-plugins enable --offline rabbitmq_delayed_message_exchange

# Hapi Rabbitmq Library

An awesome RabbitMQ Library for the Hapi ecosystem to work seamlessly with
 rabbit queues as if they were regular HTTP calls.

[![Build Status](https://api.travis-ci.com/webnator/maestro-rabbit.svg?branch=master)](https://api.travis-ci.com/webnator/maestro-rabbit)

Lead Maintainer: [webnator](https://github.com/webnator)

## Introduction

The idea behind this library is to provide a simple and seamless interface
to integrate a HapiJS API project with RabbitMQ based queues.

You won't need to change much in your current API implementation to make
 it work as an event listener from the Queue, and you can also have dual
 HTTP/Queue endpoints.

This library also works very well with [Maestro](https://github.com/webnator/maestro-workflow-manager)
A very cool workflow
manager that you should also check out now that you're here.

## Getting started

Install with
```
npm i maestro-rabbit
```

### Publish only initialization

For the simplest implementation you can call the init method with your
RabbitMQ connection parameters and this will initialize the connection and
return the instance.

```
const RabbitQueue  = require('maestro-rabbit');
const queueConfig = {
    host: 'localhost',
    port: '5672',
    user: 'rabb1tAdm1n',
    pass: '123',
    vhost: '/',
    exchange: 'rabbit_exchange',
    errorQueue: 'error',
    errorTopic: 'error.test',
    maxRetries: 3,
    reconnectionTime: 2000
}

const myConnection = await RabbitQueue.init({ queueConfig });

```

### Initialization registering handlers

In order to consume the queue in real time, we can set handlers
that listen to an specific topic and perform actions with them.

To configure these listeners we need to create a routes file first:

```
//queueRoutes-1.js

'use strict';

const testController = require('./controllers/testController');

module.exports = function(server) {
  server.route({
    topic: 'mytopic.test',
    handler: testController.handleTopic
  });
};

```

We can have as many routes file as we want, splitting for module or
functionality.
After created, we just need to group all of them into a single file:

```
// queueRouter.js
'use strict';

module.exports = function(queueRouter) {
  require('./queueRoutes-1')(queueRouter);
  require('./queueRoutes-2')(queueRouter);
  require('./queueRoutes-3')(queueRouter);
};

```

Then, instead of initializing as we showed before. We need to pass the
 routes file as a parameter to the init function.

```
const queueRouter = require('./queueRouter');
const myConnection = await RabbitQueue.init({ queueConfig, routes: queueRouter });
```

That's it!

------

After initialization, we can start working with the methods in the queue
instance.


### Consuming the queue

If we take a look at the example above, we can see that we set up a handler
 for the topic _mytopic.test_ and we said that the handler would be _testController.handleTopic_

So, inside of our testController file, we need to have a function _handleTopic_
that should have more or less the following structure

```
function handleTopic(request, reply) {
    return reply(request.payload).code(200);
}
```
[Ring a bell?](https://hapijs.com/api/16.6.2#replyerr-result)

Queue responses work in the following way:
 * __2XX responses__: Ack the message in the queue
 * __4XX responses__: Ack the message in the queue, but also publishes
 the message to the error queue and topic we defined when we initialized
  the library
 * __5XX responses__: Ack the message in the queue, but re-queues the
 message again in order to be consumed. It only retries X times as defined
 in the _maxRetries_ properties of the configuration
 * __Any other__: Ack the message in the queue, but also publishes
   the message to the error queue and topic we defined when we initialized
    the library

### Publishing to the queue

In order to publish into the queue we can use 2 functions:
* __publish__({key, msg})
* __publishHTTP__(key, { payload, headers, query, params, traceId })
* __publishDelayedHTTP__(key, { payload, headers, query, params, traceId }, delay)
* __queueManager__()

_publishHTTP_ is an implementation of the _publish_ method, that wraps
and stringifies the received parameters, and afterwards calls the 
_publish_ function.

#### .publishHTTP(String _key_, { Object _payload_, Object _headers_, Object _query_, Object _params_, String _traceId_ })

Publishes an stringified HTTP request into the topic.

Parameters:
* key: The routing ke (topic) where the message will be published
* payload: The HTTP payload in JSON format
* headers: The HTTP headers in JSON format
* query: The HTTP query in JSON format
* params: The HTTP params in JSON format
* [traceId]: The trace id for the request. Optional: For logging purposes

Returns:
* A promise

#### .publishDelayedHTTP(String _key_, { Object _payload_, Object _headers_, Object _query_, Object _params_, String _traceId_ }, Int _delay_)

Same as below, but RabbitMQ queues that implement the [delayed plugin](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange).

If your rabbit doesn't have this plugin installed, please don't use this
function. __It will fail!__

Parameters:
* key: The routing ke (topic) where the message will be published
* payload: The HTTP payload in JSON format
* headers: The HTTP headers in JSON format
* query: The HTTP query in JSON format
* params: The HTTP params in JSON format
* [traceId]: The trace id for the request. Optional: For logging purposes
* delay: The delay period in milliseconds

Returns:
* A promise

#### .publish({String _key_, String _message_})

Publishes an string into the topic.

Parameters:
* key: The routing key (topic) where the message will be published
* message: The message that we want to publish into the queue

Returns:
* A promise

#### .queueManager()

Returns the instance of the queue manager to work with its inner functions


## Configuration

#### .init({ Object _queueConfig_[, Object _extraOptions_] [, Function _routes_]})
The library initialization method, it accepts the following parameters: 
* queueConfig: The queue configuration, accepts the following paramenters:
  * host: The host to connect to __required__,
  * port: The port to connect to __required__,
  * user: The user to authenticate in the queue __required__,
  * pass: The password to authenticate in the queue __required__,
  * vhost: The rabbitMQ vhost (Usually '/') __required__,
  * exchange: The rabbitMQ exchange __required__,
  * errorQueue: The queue where to output the errors for unprocessed incoming calls (Usually 'test-error') __required__,
  * errorTopic: The topic (routing key) where to output the error (Usually error.MICROSERVICE_NAME) __required__,
  * prefetch: _Defaults to 1_,
  * delaySeconds: _Defaults to 3000_,
  * reconnectionTime: _Defaults to 2000_,
  * maxRetries: _Defaults to 5_,
  * timeBetweenRetries: _Defaults to 3000
* extraOptions: Object that Allows to set some extra options for the queue configuration, all parameters are optional
  * exchangeOptions: The settings to assert the rabbitMQ exchange [More Options](http://www.squaremobius.net/amqp.node/channel_api.html#api_reference)
    * durable: _Defaults to true_
  * queueOptions: The settings to assert the rabbitMQ queue [More Options](http://www.squaremobius.net/amqp.node/channel_api.html#api_reference)
    * noAck: _Defaults to false_
  * publisherOptions: The settings to publish into the rabbitMQ queue [More Options](http://www.squaremobius.net/amqp.node/channel_api.html#api_reference)
    * persistent: _Defaults to true_
  * retryOptions: 
    * retries: The maximum times that the retry policy will try to send a message to the queue if there's an error _Defaults to 10_
    * time: The interval that the retry policy will use when trying to re-send a message to the queue if there's an error. In milliseconds _Defaults to 1000_
* routes: The router file as described above.
    



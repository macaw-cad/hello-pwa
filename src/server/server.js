const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser')
const util = require('util');
const cors = require('cors');
const fetch = require('node-fetch');

require('dotenv').config();

const app = express();
app.use(cors());

// TODO: save subscribers somewhere
let subscribers = [];

// The reason for the email address is so that if a web push service needs to get in touch with the sender, they have some information that will enable them to. (https://developers.google.com/web/fundamentals/push-notifications/sending-messages-with-web-push-libraries)
const vapidSubject = 'mailto:erwin.smit@macaw.nl';
const publicVapidKey = process.env.PUBLIC_VAPID_KEY;
const privateVapidKey = process.env.PRIVATE_VAPID_KEY;

console.log("publicVapidKey", process.env.PUBLIC_VAPID_KEY);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

webpush.setVapidDetails(vapidSubject, publicVapidKey, privateVapidKey);

app.post('/subscribe', function (req, res) {
  let endpoint = req.body['notificationEndPoint'];
  let publicKey = req.body['publicKey'];
  let auth = req.body['auth'];

  let pushSubscription = {
      endpoint: endpoint,
      keys: {
          p256dh: publicKey,
          auth: auth
      }
  };

  subscribers.push(pushSubscription);

  res.send('Subscription accepted!');
});

app.post('/unsubscribe', function (req, res) {
  let endpoint = req.body['notificationEndPoint'];

  subscribers = subscribers.filter(subscriber => { endpoint == subscriber.endpoint });

  res.send('Subscription removed!');
});

// E.g. /notify/all?title=Take%20a%20break!&message=We%20found%20some%20nice%20campings%20nearby.%20Come%20take%20a%20look.&clickTarget=http://www.nu.nl
app.get('/notify/all', function (req, res) {
  let message = req.query.message || `test test test`;
  let clickTarget = req.query.clickTarget || `http://macaw.nl`;
  let title = req.query.title || `Push notification received!`;

  subscribers.forEach(function(pushSubscription) {
      //Can be anything you want. No specific structure necessary.
      let payload = JSON.stringify({message : message, clickTarget: clickTarget, title: title});

      webpush.sendNotification(pushSubscription, payload, {}).then((response) =>{
          console.log("Status : "+util.inspect(response.statusCode));
          console.log("Headers : "+JSON.stringify(response.headers));
          console.log("Body : "+JSON.stringify(response.body));
      }).catch((error) =>{
          console.log("Status : "+util.inspect(error.statusCode));
          console.log("Headers : "+JSON.stringify(error.headers));
          console.log("Body : "+JSON.stringify(error.body));
      });
  });

  res.send('Notification sent!');
});

// E.g. /weather?lon=4.7023787&lat=52.2910026
app.get('/weather', function(req, res) {
    const key = '6eccf768843d468db0d141839182808';
    const lat = req.query.lat;
    const lon = req.query.lon;

    fetch(`http://api.apixu.com/v1/forecast.json?key=${key}&q=${lat},${lon}&days=2`).then(function(res) { return res.json(); }).then(function(data) {
        const forecast = data.forecast.forecastday[data.forecast.forecastday.length-1];
        const temperature = parseFloat(forecast.day.avgtemp_c);
        const cold = temperature <= 18;
        const message = cold ? 'It will be a cold, take a coat.' : 'It will be warm, don\'t forget your sunglasses!';

        let payload = JSON.stringify({message : message, title: `Your holiday temperature will be ${temperature} degrees!`});
        subscribers.forEach(function(pushSubscription) {
            webpush.sendNotification(pushSubscription, payload, {});
        });
    });

    res.send('Latitude: ' + lat + ', longitude: ' + lon);
});

app.get('/', (req, res) => res.send('Hello World!'))

const port = process.env.PORT || 3001;

app.listen(port, () => console.log('Example app listening on port ' + port))
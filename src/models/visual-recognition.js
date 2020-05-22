const VisualRecognitionV4 = require('ibm-watson/visual-recognition/v4');
const { IamAuthenticator } = require('ibm-watson/auth');

const visualRecognition = new VisualRecognitionV4({
  version: '2019-02-11',
  authenticator: new IamAuthenticator({
    apikey: 'VvrAe6iiy3KQmgomWNdSMNav3WQ39-7FlPvYd8Bi_KZ-'
  }),
  url: 'https://api.us-south.visual-recognition.watson.cloud.ibm.com/instances/2402ca1c-648c-456a-9b62-ad4c02d2404b'
});

module.exports = visualRecognition
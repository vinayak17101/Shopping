const VisualRecognitionV4 = require('ibm-watson/visual-recognition/v4');
const { IamAuthenticator } = require('ibm-watson/auth');

const visualRecognition = new VisualRecognitionV4({
  version: '2019-02-11',
  authenticator: new IamAuthenticator({
    apikey: 'r2AJPZ7MZMdbR9wXpxSOKFh1AhqwnHGxqVvxnrUzxKYM'
  }),
  url: 'https://api.us-south.visual-recognition.watson.cloud.ibm.com/instances/f2e188f0-342d-414a-ada1-1d810ff3a6b2'
});

module.exports = visualRecognition
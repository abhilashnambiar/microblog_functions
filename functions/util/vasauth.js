const { admin } = require('../util/admin');

module.exports = (req,res,next) => {
    let idToken;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    }
    else {
        console.error('No token!!');
        return res.json({ error: 'Unauthorized'});
    }

    admin.auth().verifyIdToken(idToken).then(dcoded => {
        req.user = dcoded;
        return admin.firestore().collection('users').where('userID', '==', req.user.uid).limit(1).get();
    }).then(data => {
        req.user.user = data.docs[0].data().user;
        req.user.imageUrl = data.docs[0].data().imageUrl;
        return next();
    }).catch(err => {
        console.error('Invalid Token!', err);
        return res.json(err);
    })
}
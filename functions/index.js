const functions = require('firebase-functions');
const express = require('express');
const app = express();

const { admin } = require('./util/admin')

const cors = require('cors');
app.use(cors());

const { getPosts, postPost, getOnePost, newComment, likePost, unlikePost, deletePost } = require('./handlers/posts');
const { signUp, logIn, uploadDP, userDetails, getUser, publicUser, notifyRead, postImage } = require('./handlers/users');

const vaSAuth = require('./util/vasauth');

app.get('/posts', getPosts); 
app.post('/post', vaSAuth, postPost);
app.get('/posts/:postID', getOnePost);
app.post('/posts/:postID/comment', vaSAuth, newComment);

app.post('/postimg', vaSAuth, postImage);

app.delete('/posts/:postID/delete', vaSAuth, deletePost);

app.get('/posts/:postID/like', vaSAuth, likePost);
app.get('/posts/:postID/unlike', vaSAuth, unlikePost);
app.post('/notify', vaSAuth, notifyRead);

app.post('/signup', signUp);
app.post('/login', logIn);

app.post('/user/image', vaSAuth, uploadDP);
app.post('/user', vaSAuth, userDetails);
app.get('/user', vaSAuth, getUser);
app.get('/user/:user', publicUser);


exports.api = functions.region('asia-east2').https.onRequest(app);

exports.notifyLike = functions.region('asia-east2').firestore.document('likes/{id}').onCreate((snap) => {
    return admin.firestore().doc(`/posts/${snap.data().postID}`).get().then(doc => {
        if(doc.exists) {
            return admin.firestore().doc(`/notifications/${snap.id}`).set({
                time: new Date().toISOString(),
                from: snap.data().user,
                to: doc.data().user,
                type: 'like',
                read: false,
                postID: doc.id
            });
        }
    });
})

exports.notifyComment = functions.region('asia-east2').firestore.document('comments/{id}').onCreate((snap) => {
    return admin.firestore().doc(`/posts/${snap.data().postID}`).get().then(doc => {
        if(doc.exists) {
            return admin.firestore().doc(`/notifications/${snap.id}`).set({
                time: new Date().toISOString(),
                from: snap.data().user,
                to: doc.data().user,
                type: 'comment',
                read: false,
                postID: doc.id
            });
        }
    });
})

exports.deleteLike = functions.region('asia-east2').firestore.document('likes/{id}').onDelete((snap) => {
    return admin.firestore().doc(`/notifications/${snap.id}`).delete()
});
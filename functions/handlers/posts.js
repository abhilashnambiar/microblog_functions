const { admin } = require('../util/admin');
 
exports.getPosts = (req,res) => {
    admin.firestore().collection('posts').orderBy('time','desc').get().then((data) => {
        let posts = [];
        data.forEach((doc) => {
            posts.push({
                postID: doc.id,
                ...doc.data()
            });
        });
        return res.json(posts);
    }).catch((err) => console.error(err));
};

exports.postPost = (req,res) => {
    if (req.body.body.trim() === '') {
        return res.status(400).json({ body: 'Body must not be empty' });
    }

    const newPost = {
        body: req.body.body,
        time: new Date().toISOString(),
        title: req.body.title,
        userImage: req.user.imageUrl,
        user: req.user.user,
        likeCount: 0,
        commentCount: 0
    };

    admin.firestore().collection('posts').add(newPost).then((doc) => {
        const resPost = newPost;
        resPost.postID = doc.id;
        return res.json(resPost);
    }).catch((err) => console.error(err));
};

exports.getOnePost = (req,res) => {
    let postData = {};
    admin.firestore().doc(`/posts/${req.params.postID}`).get().then(doc => {
        if(!doc.exists) {
            return res.json({ error: "post not found" })
        }
        postData = doc.data();
        postData.postID = doc.id;
        return admin.firestore().collection('comments').orderBy('time', 'desc').where('postID', '==', req.params.postID).get();
    }).then(data => {
        postData.comments = [];
        data.forEach(doc => {
            postData.comments.push(doc.data())
    });
        return res.json(postData);
    }).catch(err => {  
        res.json({ error: err.code });
    });
}

exports.newComment = (req,res) => {
    if(req.body.body.trim() === '') return res.json({ error: "empty object"});
    const newcom = {
        body: req.body.body,
        time: new Date().toISOString(),
        user: req.user.user,
        postID: req.params.postID,
        userImage: req.user.imageUrl
    };
    admin.firestore().doc(`/posts/${req.params.postID}`).get().then(doc => {
        if(!doc.exists) {
            return res.json({ error: "Post doesn't exist anymore!!"});
        }
        return doc.ref.update({ commentCount: doc.data().commentCount + 1});
    }).then(() => {
        return admin.firestore().collection('comments').add(newcom);
    }).then(() => {
        res.json(newcom);
    }).catch(err => {
        res.json({ error: err.code});
    })
}

exports.likePost = (req,res) => {
    const likeDoc = admin.firestore().collection('likes').where('user', '==', req.user.user).where('postID', '==', req.params.postID).limit(1);
    const postDoc = admin.firestore().doc(`/posts/${req.params.postID}`);

    let postData = {};

    postDoc.get().then(doc => {
        if(doc.exists) {
            postData = doc.data();
            postData.postID = doc.id;
            return likeDoc.get();
        }
        else {
            return res.json({ error: 'post not found' });
        }
    }).then(data => {
        if(data.empty) {
            return admin.firestore().collection('likes').add({
                postID: req.params.postID,
                user: req.user.user
            }).then(() => {
                postData.likeCount++;
                return postDoc.update({ likeCount: postData.likeCount });
            }).then(() => {
                return res.json(postData);
            })
        } else {
            return res.json({ error: "post already liked ahole!!"})
        }
    }).catch(err => {
        res.json({ error: err.code });
    })

};

exports.unlikePost = (req, res) => {
    const likeDoc = admin.firestore().collection('likes').where('user', '==', req.user.user).where('postID', '==', req.params.postID).limit(1);
    const postDoc = admin.firestore().doc(`/posts/${req.params.postID}`);

    let postData = {};

    postDoc.get().then(doc => {
        if(doc.exists) {
            postData = doc.data();
            postData.postID = doc.id;
            return likeDoc.get();
        }
        else {
            return res.json({ error: 'post not found' });
        }
    }).then(data => {
        if(data.empty) {
            return res.json({ error: "post not liked!!"})
        } else {
            return admin.firestore().doc(`/likes/${data.docs[0].id}`).delete().then(() => {
                postData.likeCount--;
                return postDoc.update({ likeCount: postData.likeCount });
            }).then(() => {
                res.json(postData);
            })
        }
    }).catch(err => {
        res.json({ error: err.code });
    })
}

exports.deletePost = (req,res) => {
    const document = admin.firestore().doc(`/posts/${req.params.postID}`);
    document.get().then(doc => {
        if(!doc.exists) {
            return res.json({ error: "post never existed mate!!"});
        }
        if(doc.data().user !== req.user.user) {
            return res.json({ error: "unauthorized user!"});
        } else {
            return document.delete();
        }
    }).then(() => {
        return res.json({ message: "Its deleted mate!!"})
    }).catch(err => {
        return res.json({ error: err.code });
    })
}



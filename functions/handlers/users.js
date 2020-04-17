const config = require('../util/config');

const firebase = require('firebase');
firebase.initializeApp(config);

const { admin } = require('../util/admin');

const isEmail = (email) => {
    if(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) return true;
    else return false;
};

const isEmpty = (string) => {
    if(string.trim() === '') return true;
    else return false;
};

const reduceUserDetails = (data) => {
    let userDet = {};
    if(!isEmpty(data.bio.trim())) userDet.bio = data.bio;
    if(!isEmpty(data.website.trim())) {
        if(data.website.trim().substring(0, 4) !== 'http') {
            userDet.website = `http://${data.website.trim()}`;
        } 
        else userDet.website = data.website;
    }
    if(!isEmpty(data.location.trim())) userDet.location = data.location;

    return userDet;
}

exports.signUp = (req,res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        user: req.body.user,
    }

    let errors = {};

    if(isEmpty(newUser.email)) {
        errors.email = "Email Required!";
    } else if(!isEmail(newUser.email)) {
        errors.email = "Email Invalid!";
    }

    if(isEmpty(newUser.password)) errors.password = "Password is Empty!";
    if(newUser.password !== newUser.confirmPassword) errors.confirmPassword = "Password Mismatch!";
    if(isEmpty(newUser.user)) errors.user = "Username Required!";

    if(Object.keys(errors).length > 0) return res.status(400).json(errors);

    const defImg = 'def.jpg'

    let token, userID;
    admin.firestore().doc(`/users/${newUser.user}`).get().then(doc => {
        if(doc.exists){
            return res.status(400).json({ user: "This user already exixts"});
        }
        else {
            return firebase.auth().createUserWithEmailAndPassword(newUser.email,newUser.password);
        }
    }).then((data) => {
        userID = data.user.uid;
        return data.user.getIdToken();
    }).then((tokenid) => {
        token = tokenid;
        const userCredentials = {
            user: newUser.user,
            email: newUser.email,
            time: new Date().toISOString(),
            imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${defImg}?alt=media`,
            userID
        };

        return admin.firestore().doc(`/users/${newUser.user}`).set(userCredentials);
    }).then(() => {
        return res.json({ token });
    }).catch((err) => {
        return res.status(500).json({ error: err.code });
    });
};

exports.logIn =  (req,res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    let errors = {};

    if(isEmpty(user.email)) errors.email = "Email Required!";
    if(isEmpty(user.password)) errors.password = "Password Required!";

    if(Object.keys(errors).length > 0) return res.status(400).json(errors);

    firebase.auth().signInWithEmailAndPassword(user.email,user.password).then(data => {
        return data.user.getIdToken();
    }).then(token => {
        return res.json({ token });
    }).catch((err) => {
        return res.status(403).json({ general: "Wrong Authentication Details!" });
    });
};

exports.uploadDP = (req, res) => {
    const Busboy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    const instBus = new Busboy({ headers: req.headers });

    let imageFileName;
    let imageToBeUploaded = {};

    instBus.on('file', (fieldname,file,filename,encoding,mimetype) => {
        if(mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
            return res.json({ error: "Wrong file type idiota!!"});
        }
        const imageExt = filename.split('.')[filename.split('.').length - 1];
        imageFileName = `${Math.round(Math.random()*1000000000000).toString()}.${imageExt}`;
        const filepath = path.join(os.tmpdir(), imageFileName);
        imageToBeUploaded = { filepath, mimetype };
        file.pipe(fs.createWriteStream(filepath));
    });
    instBus.on('finish', () => {
        admin.storage().bucket().upload(imageToBeUploaded.filepath, {
            resumable: false,
            metadata: {
                metadata: {
                    contentType: imageToBeUploaded.mimetype
                }
            }
        }).then(() => {
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
            return admin.firestore().doc(`/users/${req.user.user}`).update({ imageUrl });
        }).then(() => {
            return res.json({ message: 'Image uploaded Successfully!!' });
        }).catch((err) => {
            return res.json({ error: err.code });
        });
    });
    instBus.end(req.rawBody);
};

exports.userDetails = (req,res) => {
    let userDet = reduceUserDetails(req.body);
    admin.firestore().doc(`users/${req.user.user}`).update(userDet).then(() => {
        return res.json({ message: "Details updated!"});
    }).catch(err => {
        return res.json({ error: err.code });
    });
    
};

exports.getUser = (req,res) => {
    let resData = {};
    admin.firestore().doc(`/users/${req.user.user}`).get().then(doc => {
        if(doc.exists) {
            resData.credentials = doc.data();
            return admin.firestore().collection('likes').where('user', '==', req.user.user).get();
        }
    }).then((data) => {
        resData.likes = [];
        data.forEach((doc) => {
            resData.likes.push(doc.data());
        });
        return admin.firestore().collection('notifications').where('to', '==', req.user.user).orderBy('time', 'desc').limit(10).get();
    }).then(data => {
        resData.notif = [];
        data.forEach(doc => {
            resData.notif.push({
                ...doc.data(),
                notifyID: doc.id
            })
        });
        return res.json(resData);
    }).catch(err => {
        return res.json({ error: err.code});
    })
}

exports.publicUser = (req,res) => {
    let userData = {};
    admin.firestore().doc(`/users/${req.params.user}`).get().then(doc => {
        if(doc.exists) {
            userData.user = doc.data();
            return admin.firestore().collection('posts').where('user', '==', req.params.user).orderBy('time', 'desc').get();
        } else {
            return res.json({ error: "user not found!"})
        }
    }).then(data => {
        userData.posts = []
        data.forEach(doc => {
            userData.posts.push({
                ...doc.data(),
                postID: doc.id
            })
        });
        return res.json(userData);
    }).catch(err => {
        return res.json({ error: err.code })
    })
}

exports.notifyRead = (req,res) => {
    let batch = admin.firestore().batch();
    req.body.forEach(notifID => {
        const notif = admin.firestore().doc(`/notifications/${notifID}`);
        batch.update(notif, { read: true });
    });
    batch.commit().then(() => {
        return res.json({ message: 'notifs marked read!!'});
    }).catch(err => {
        return res.json({ error: err.code });
    })
}

exports.postImage = (req, res) => {
    const Busboy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    const instBus = new Busboy({ headers: req.headers });

    let imageFileName;
    let imageToBeUploaded = {};

    instBus.on('file', (fieldname,file,filename,encoding,mimetype) => {
        if(mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
            return res.json({ error: "Wrong file type idiota!!"});
        }
        const imageExt = filename.split('.')[filename.split('.').length - 1];
        imageFileName = `${Math.round(Math.random()*1000000000000).toString()}.${imageExt}`;
        const filepath = path.join(os.tmpdir(), imageFileName);
        imageToBeUploaded = { filepath, mimetype };
        file.pipe(fs.createWriteStream(filepath));
    });
    instBus.on('finish', () => {
        admin.storage().bucket().upload(imageToBeUploaded.filepath, {
            resumable: false,
            metadata: {
                metadata: {
                    contentType: imageToBeUploaded.mimetype
                }
            }
        }).then(() => {
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
            newPost = {
                imageUrl,
                time: new Date().toISOString(),
                userImage: req.user.imageUrl,
                user: req.user.user,
                likeCount: 0,
                commentCount: 0

            }
            return admin.firestore().collection('posts').add(newPost);
        }).then(() => {
            return res.json({ message: 'Image uploaded Successfully!!' });
        }).catch((err) => {
            return res.json({ error: err.code });
        });
    });
    instBus.end(req.rawBody);
};
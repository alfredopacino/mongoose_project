var express = require('express');
var mongoose = require('mongoose');
var async = require('async');
var Schema = mongoose.Schema;
var ObjectId=mongoose.Schema.Types.ObjectId;
var app = express();
require('mongoose').set('debug', true)

var userSchema = new Schema({
    name:{type:String,required:true}
}, { collection: 'users' });

var User = mongoose.model('user',userSchema);

var options = { discriminatorKey: '_type',collection:'posts' };

var PostSchema= new Schema(
    {
        title:{type:String,required:true},
        content:{type:String},
        author:{type:ObjectId,ref:'user'}
    },
    options);
var Post = mongoose.model('post',PostSchema);

var Post1 = Post.discriminator('post_type1', new Schema(
    {
        tags:{type:String},
        comments:{type:String}
    },
    options));
var Post2 = Post.discriminator('post_type2',new Schema(
    {
        coauthor:{type:ObjectId,ref:'user'},
        coauthor_comment:{type:String}
    },
    options));
PostSchema.index({ _type: 1, "$**": "text" });

app.get('/users', function (req, res) {
    User.find(function(err,data){
        if(err)
            res.json(err)
        res.json(data);
    });
});
app.get('/posts', function (req, res) {
    Post
        .find()
        .populate('author')
        .populate('coauthor')
        .exec(function(err,data){
            if(err)
                res.json(err)
            res.json(data);
        });
});
//refresh this route few times for populate the db
app.get('/init', function (req, res) {
    var _users = [
        new User({name:"John "+randString(5)}),
        new User({name:"James "+randString(5)})
    ];
    var user_ids=[];
    async.waterfall([
        function(callback) {

            async.forEach(_users, function(user, next) {
               user.save(function(err,doc){
                   if(err)
                       next(err);
                   user_ids.push(doc._id)
                   next(null);
               })
            }, function(err) {
                if (err)
                    return callback(err);
                callback(null);
            });
        },
        function(callback) {
            console.log(user_ids);

            var _posts = [
                new Post1({
                    title:"myTitle",
                    content:"this is my first post and this is a random string: "+randString(20),
                    author:user_ids[0]
                }),
                new Post2({
                    title:"Title2",
                    content:"this is my first collective post :) I like random strings too: "+randString(20),
                    author:user_ids[1],
                    coauthor:user_ids[0],
                    coauthor_comment:"i'm the coauthor and this is my opinion"
                })
            ]
            callback(null,_posts);
        },
        function(_posts,callback) {
            async.forEach(_posts, function(post, next) {
                post.save(function(err,doc){
                    if(err)
                        console.log(err)
                    next(null);
                })
            }, function(err) {
                if (err)
                    return callback(err);
                callback(null);
            });
            callback();
        }
    ], function(err) {

        if (err) {
            res.json({message: err});
        } else {
           res.json({message:'2 users and 2 post has been created'})
        }
    });
});
//REFS: NOT works
app.get('/search_ref', function (req, res) {

    //find an coauthor id from initalization (/post resource)
    Post.find({coauthor:'571a97c72617c1a41d4b1bef'})
        .exec(function(err, data) {
            if (err) {
                return res.status(400).send({
                    message: err
                });
            } else {
                res.json(data);
            }
        });
});
//STRING: works
//'coauthor_comment' is an inherited field, but querying it on the base model works
app.get('/search_string', function (req, res) {
    Post.find({coauthor_comment:new RegExp('this is')})
        .exec(function(err, data) {
            if (err) {
                return res.status(400).send({
                    message: err
                });
            } else {
                res.json(data);
            }
        });
});
//Full text search: not works
app.get('/fulltext', function (req, res) {
    Post
        .find(
            {
                _type: {$in: ['post_type1', 'post_type2']},
                $text : { $search :"first collective" }
            }

        )
        .exec(function(err, data) {
            if(err)console.log(err)
            res.json(data)
        });
});
function randString(len)
{   var text = "";
    var possible = "ABCDEFGHI KLMNOPQRSTUVWXYZ abcdefghijklmnopqrs tuvwxyz0123456789";
    for( var i=0; i < len; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}
app.listen(3001, function () {
    console.log('Debug app listening on port 3001!');
});
var db = mongoose.connect('mongodb://127.0.0.1:27017/mongoose');
mongoose.connection.once('connected', function() {
    console.log("Connected to database")
});

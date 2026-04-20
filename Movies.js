const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ActorSchema = new Schema({
    actorName: {
        type: String,
        required: [true, 'actor name is required']
    },
    characterName: {
        type: String,
        required: [true, 'character name is required']
    }
}, { _id: false });

const MovieSchema = new Schema({
    title: {
        type: String,
        required: [true, 'title is required'],
        index: true
    },
    releaseDate: {
        type: Number,
        required: [true, 'release date is required'],
        min: [1900, 'Must be greater than 1899'],
        max: [2100, 'Must be less than 2100']
    },
    genre: {
        type: String,
        required: [true, 'genre is required'],
        enum: [
            'Action',
            'Adventure',
            'Comedy',
            'Drama',
            'Fantasy',
            'Horror',
            'Mystery',
            'Thriller',
            'Western',
            'Science Fiction'
        ]
    },
    actors: {
        type: [ActorSchema],
        validate: {
            validator: function(value) {
                return Array.isArray(value) && value.length > 0;
            },
            message: 'movie must contain at least one actor'
        }
    }
});

module.exports = mongoose.model('Movie', MovieSchema);
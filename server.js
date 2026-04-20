require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const authJwtController = require('./auth_jwt'); // You're not using authController, consider removing it
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./Users');
const Movie = require('./Movies'); // You're not using Movie, consider removing it
const mongoose = require('mongoose');
const Review = require('./Reviews');


const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

const router = express.Router();

// Removed getJSONObjectForMovieRequirement as it's not used

router.post('/signup', async (req, res) => { // Use async/await
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ success: false, msg: 'Please include both username and password to signup.' }); // 400 Bad Request
  }

  try {
    const user = new User({ // Create user directly with the data
      name: req.body.name,
      username: req.body.username,
      password: req.body.password,
    });

    await user.save(); // Use await with user.save()

    res.status(201).json({ success: true, msg: 'Successfully created new user.' }); // 201 Created
  } catch (err) {
    if (err.code === 11000) { // Strict equality check (===)
      return res.status(409).json({ success: false, message: 'A user with that username already exists.' }); // 409 Conflict
    } else {
      console.error(err); // Log the error for debugging
      return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
    }
  }
});


router.post('/signin', async (req, res) => { // Use async/await
  try {
    const user = await User.findOne({ username: req.body.username }).select('name username password');

    if (!user) {
      return res.status(401).json({ success: false, msg: 'Authentication failed. User not found.' }); // 401 Unauthorized
    }

    const isMatch = await user.comparePassword(req.body.password); // Use await

    if (isMatch) {
      const userToken = { id: user._id, username: user.username }; // Use user._id (standard Mongoose)
      const token = jwt.sign(userToken, process.env.SECRET_KEY, { expiresIn: '1h' }); // Add expiry to the token (e.g., 1 hour)
      res.json({ success: true, token: 'JWT ' + token });
    } else {
      res.status(401).json({ success: false, msg: 'Authentication failed. Incorrect password.' }); // 401 Unauthorized
    }
  } catch (err) {
    console.error(err); // Log the error
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
  }
});

router.route('/movies')
    .get(authJwtController.isAuthenticated, async (req, res) => {
        try {
            const movies = await Movie.find({});
            return res.status(200).json(movies);
        } catch (err) {
            console.error(err);
            return res.status(500).json({
                success: false,
                message: 'failed to retrieve movies'
            });
        }
    })
    .post(authJwtController.isAuthenticated, async (req, res) => {
        try {
            const movie = new Movie({
                title: req.body.title,
                releaseDate: req.body.releaseDate,
                genre: req.body.genre,
                actors: req.body.actors
            });

            const savedMovie = await movie.save();

            return res.status(201).json({
                success: true,
                movie: savedMovie
            });
        } catch (err) {
            console.error(err);
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }
    });

    router.route('/movies/:movieparameter')
    .get(authJwtController.isAuthenticated, async (req, res) => {
        try {
            const movieId = req.params.movieparameter;

            if (!mongoose.Types.ObjectId.isValid(movieId)) {
                return res.status(400).json({
                    success: false,
                    message: 'invalid movie id'
                });
            }

            const result = await Movie.aggregate([
                {
                    $match: {
                        _id: new mongoose.Types.ObjectId(movieId)
                    }
                },
                {
                    $lookup: {
                        from: 'reviews',
                        localField: '_id',
                        foreignField: 'movieId',
                        as: 'reviews'
                    }
                },
                {
                    $addFields: {
                        avgRating: {
                            $cond: [
                                { $gt: [{ $size: '$reviews' }, 0] },
                                { $avg: '$reviews.rating' },
                                0
                            ]
                        }
                    }
                },
                {
                    $project: {
                        title: 1,
                        releaseDate: 1,
                        genre: 1,
                        actors: 1,
                        reviews: 1,
                        avgRating: { $round: ['$avgRating', 1] }
                    }
                }
            ]);

            if (!result || result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'movie not found'
                });
            }

            return res.status(200).json(result[0]);
        } catch (err) {
            console.error(err);
            return res.status(500).json({
                success: false,
                message: 'failed to retrieve movie'
            });
        }
    })

    .put(authJwtController.isAuthenticated, async (req, res) => {
        try {
            const movieId = req.params.movieparameter;

            if (!mongoose.Types.ObjectId.isValid(movieId)) {
                return res.status(400).json({
                    success: false,
                    message: 'invalid movie id'
                });
            }

            const updatedMovie = await Movie.findByIdAndUpdate(
                movieId,
                {
                    title: req.body.title,
                    releaseDate: req.body.releaseDate,
                    genre: req.body.genre,
                    actors: req.body.actors
                },
                {
                    new: true,
                    runValidators: true
                }
            );

            if (!updatedMovie) {
                return res.status(404).json({
                    success: false,
                    message: 'movie not found'
                });
            }

            return res.status(200).json({
                success: true,
                movie: updatedMovie
            });
        } catch (err) {
            console.error(err);
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }
    })

    .delete(authJwtController.isAuthenticated, async (req, res) => {
        try {
            const movieId = req.params.movieparameter;

            if (!mongoose.Types.ObjectId.isValid(movieId)) {
                return res.status(400).json({
                    success: false,
                    message: 'invalid movie id'
                });
            }

            const deletedMovie = await Movie.findByIdAndDelete(movieId);

            if (!deletedMovie) {
                return res.status(404).json({
                    success: false,
                    message: 'movie not found'
                });
            }

            await Review.deleteMany({ movieId: movieId });

            return res.status(200).json({
                success: true,
                message: 'movie deleted successfully'
            });
        } catch (err) {
            console.error(err);
            return res.status(500).json({
                success: false,
                message: 'failed to delete movie'
            });
        }
    });

    router.post('/reviews', authJwtController.isAuthenticated, async (req, res) => {
        try {
            const { movieId, reviewerName, rating, review } = req.body;
    
            if (!movieId || !reviewerName || rating === undefined || !review) {
                return res.status(400).json({
                    success: false,
                    message: 'movieId, reviewerName, rating, and review are required'
                });
            }
    
            if (!mongoose.Types.ObjectId.isValid(movieId)) {
                return res.status(400).json({
                    success: false,
                    message: 'invalid movieId format'
                });
            }
    
            const movieExists = await Movie.findById(movieId);
            if (!movieExists) {
                return res.status(404).json({
                    success: false,
                    message: 'movie not found'
                });
            }
    
            const newReview = new Review({
                movieId,
                reviewerName,
                rating,
                review
            });
    
            const savedReview = await newReview.save();
    
            return res.status(201).json({
                success: true,
                review: savedReview
            });
        } catch (err) {
            console.error(err);
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }
    });

    router.get('/reviews/:movieId', authJwtController.isAuthenticated, async (req, res) => {
        try {
            const { movieId } = req.params;
    
            if (!mongoose.Types.ObjectId.isValid(movieId)) {
                return res.status(400).json({
                    success: false,
                    message: 'invalid movieId format'
                });
            }
    
            const reviews = await Review.find({ movieId });
    
            return res.status(200).json(reviews);
    
        } catch (err) {
            console.error(err);
            return res.status(500).json({
                success: false,
                message: 'failed to retrieve reviews'
            });
        }
    });

router.route('/reviews/:movieID')


app.use('/', router);

const PORT = process.env.PORT || 8080; // Define PORT before using it
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // for testing only
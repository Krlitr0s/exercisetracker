const express = require('express')
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express()
const cors = require('cors')
require('dotenv').config()

const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });


app.use(cors())
app.use(express.static('public'))

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

const { Schema } = mongoose;

const userSchema = new Schema({
  username: { type: String, required: true }
});

const exerciseSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, required: true }
});

const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/users', async (req, res) => {
  try {
    const username = req.body.username;
    if (!username) return res.status(400).json({ error: 'username required' });

    const user = new User({ username });
    const saved = await user.save();
    res.json({ username: saved.username, _id: saved._id });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '_id username').exec();
    res.json(users.map(u => ({ username: u.username, _id: u._id })));
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const userId = req.params._id;
    const { description, duration, date } = req.body;

    if (!description || !duration) {
      return res.status(400).json({ error: 'description and duration required' });
    }

    const user = await User.findById(userId).exec();
    if (!user) return res.status(400).json({ error: 'user not found' });

    const dur = Number(duration);
    if (Number.isNaN(dur)) return res.status(400).json({ error: 'duration must be a number' });

    const dateObj = date ? new Date(date) : new Date();
    if (date && dateObj.toString() === 'Invalid Date') {
      return res.status(400).json({ error: 'Invalid Date' });
    }

    const exercise = new Exercise({
      userId: user._id,
      description,
      duration: dur,
      date: dateObj
    });

    const saved = await exercise.save();

    res.json({
      username: user.username,
      description: saved.description,
      duration: saved.duration,
      date: saved.date.toDateString(),
      _id: user._id
    });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const userId = req.params._id;
    const { from, to, limit } = req.query;

    const user = await User.findById(userId).exec();
    if (!user) return res.status(400).json({ error: 'user not found' });

    const query = { userId: user._id };

    const dateFilter = {};
    if (from) {
      const fromDate = new Date(from);
      if (fromDate.toString() === 'Invalid Date') return res.status(400).json({ error: 'Invalid from date' });
      dateFilter.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (toDate.toString() === 'Invalid Date') return res.status(400).json({ error: 'Invalid to date' });
      dateFilter.$lte = toDate;
    }
    if (Object.keys(dateFilter).length) {
      query.date = dateFilter;
    }

    let q = Exercise.find(query).sort({ date: 'asc' });

    if (limit) {
      const lim = parseInt(limit);
      if (!Number.isNaN(lim)) q = q.limit(lim);
    }

    const exercises = await q.exec();

    const log = exercises.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      date: ex.date.toDateString()
    }));

    res.json({
      username: user.username,
      count: log.length,
      _id: user._id,
      log
    });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

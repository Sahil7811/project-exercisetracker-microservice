const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const User = require("./User");
const Exercise = require("./Exercise");

// middleware
app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1); // Exit if DB connection fails
  }
};
connectDB();

// routes
// 1) create a new user and return response : username and _id
app.post("/api/users", async function (req, res) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    let existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.json({
        username: existingUser.username,
        _id: existingUser._id,
      });
    }

    const newUser = new User({ username });
    const saveUser = await newUser.save();

    res.json({ username: newUser.username, _id: newUser._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 2) to get all users : username and id
app.get("/api/users", async function (req, res) {
  try {
    const users = await User.find({}, "username _id"); // Only return username and _id
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 3) save exercise and return response
app.post("/api/users/:_id/exercises", async (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;

  if (!description || !duration) {
    return res
      .status(400)
      .json({ error: "Description and duration are required" });
  }

  const durationNum = parseInt(duration);
  if (isNaN(durationNum)) {
    return res.status(400).json({ error: "Duration must be a number" });
  }

  let exerciseDate;
  if (date) {
    exerciseDate = new Date(date);
    if (exerciseDate.toString() === "Invalid Date") {
      return res.status(400).json({ error: "Invalid date format" });
    }
  } else {
    exerciseDate = new Date();
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const exercise = new Exercise({
      username: user.username,
      description,
      duration: durationNum,
      date: exerciseDate,
    });

    await exercise.save();

    res.json({
      _id: user._id,
      username: user.username,
      date: exerciseDate.toDateString(),
      duration: durationNum,
      description,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 4)
app.get("/api/users/:_id/logs", async (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Build date filter
    const dateFilter = {};
    if (from) {
      const fromDate = new Date(from);
      if (fromDate.toString() !== "Invalid Date") {
        dateFilter.$gte = fromDate;
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (toDate.toString() !== "Invalid Date") {
        dateFilter.$lte = toDate;
      }
    }

    const query = {
      username: user.username,
      ...(Object.keys(dateFilter).length && { date: dateFilter }),
    };

    let exercisesQuery = Exercise.find(query);

    // Apply limit if provided
    if (limit) {
      const lim = parseInt(limit);
      if (!isNaN(lim)) {
        exercisesQuery = exercisesQuery.limit(lim);
      }
    }

    const exercises = await exercisesQuery.exec();

    const log = exercises.map((e) => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString(),
    }));

    res.json({
      username: user.username,
      _id: user._id,
      count: log.length,
      log,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

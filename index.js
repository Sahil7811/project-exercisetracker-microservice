const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const User = require("./User");
const Exercise = require("./Exercise");

// Middleware
app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

// DB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};
connectDB();

// Create new user
app.post("/api/users", async (req, res) => {
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
    await newUser.save();

    res.json({ username: newUser.username, _id: newUser._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, "username _id");
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add an exercise
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
      userId: user._id,
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

// Get exercise logs
app.get("/api/users/:_id/logs", async (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Build date filter if applicable
    const dateFilter = {};
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate)) dateFilter.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate)) dateFilter.$lte = toDate;
    }

    // Build MongoDB query filter
    const filter = { userId: user._id };
    if (Object.keys(dateFilter).length > 0) {
      filter.date = dateFilter;
    }

    // Query exercises
    let query = Exercise.find(filter).sort({ date: "asc" });
    if (limit) {
      const lim = parseInt(limit);
      if (!isNaN(lim)) query = query.limit(lim);
    }

    const exercises = await query.exec();

    // Format the log
    const log = exercises.map((e) => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString(),
    }));

    // Respond with user logs
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

// Start server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 App is listening on port " + listener.address().port);
});

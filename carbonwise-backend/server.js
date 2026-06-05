app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/ai", require("./routes/aiRoutes"));
const reportRoutes = require('./routes/reportRoutes');
//Added new Activity
app.use('/api/reports', reportRoutes);
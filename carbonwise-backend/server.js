app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/ai", require("./routes/aiRoutes"));
const reportRoutes = require('./routes/reportRoutes');

app.use('/api/reports', reportRoutes);
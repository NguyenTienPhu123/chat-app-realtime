const mongoose = require("mongoose");

// Kết nối MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Kết nối thành công đến MongoDB");
    } catch (error) {
        console.log("Lỗi kết nối MongoDB:", error);
        process.exit(1);
    }
};

module.exports = {
    connectDB,
};
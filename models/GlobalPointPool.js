const mongoose = require('mongoose');

// Global Point Pool Schema for tracking monthly points
const GlobalPointPoolSchema = new mongoose.Schema({
    month: {
        type: Number,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    totalMonthlyPoints: {
        type: Number,
        default: 0
    }
});

// Static method to find or create the global point pool for the current month
GlobalPointPoolSchema.statics.findOrCreateForCurrentMonth = async function () {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    let globalPointPool = await this.findOne({ month, year });

    if (!globalPointPool) {
        globalPointPool = new this({ month, year, totalMonthlyPoints: 0 });
        await globalPointPool.save();
    }

    return globalPointPool;
};

const GlobalPointPool = mongoose.model('GlobalPointPool', GlobalPointPoolSchema);
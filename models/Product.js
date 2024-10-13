const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: String,
    price: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0,
    },
    discountedPrice: {
        type: Number
    },
    points: {
        type: Number,
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    },
    stock: {
        type: Number,
        default: 0
    },
    reviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review'
    }],
    images: {
        type: [String],
        validate: {
            validator: function (v) {
                return v.length >= 3;
            },
            message: 'At least three images are required.'
        },
        required: true
    },
    activationProduct: {
        type: Boolean,
        default: false
    }
});

function calculateDiscountedPrice(price, discount = 0) {
    const discountAmount = (price * discount) / 100;
    return parseFloat((price - discountAmount).toFixed(2));
}

ProductSchema.pre('save', function(next) {
    if (this.isModified('price') || this.isModified('discount')) {
        this.discountedPrice = calculateDiscountedPrice(this.price, this.discount);
    }
    next();
});

ProductSchema.pre('findOneAndUpdate', async function(next) {
    const update = this.getUpdate();
    const query = this.getQuery();

    // Fetch the existing product
    const existingProduct = await this.model.findOne(query);

    if (!existingProduct) {
        return next();
    }

    const newPrice = update.price ?? update.$set?.price ?? existingProduct.price;
    const newDiscount = update.discount ?? update.$set?.discount ?? existingProduct.discount;

    if (!this._update.$set) this._update.$set = {};
    this._update.$set.discountedPrice = calculateDiscountedPrice(newPrice, newDiscount);

    next();
});

module.exports = mongoose.model('Product', ProductSchema);
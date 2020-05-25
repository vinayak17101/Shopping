module.exports = function Cart(oldCart) {
    this.items = oldCart.items || {};
    this.totalQty = oldCart.totalQty || 0;

    this.add = function(item, id, qty) {
        var storedItem = this.items[id]
        if(!storedItem) {
            storedItem = this.items[id] = {item: item, qty: 0, price: 0}
            this.totalQty++;
        }
        storedItem.qty += qty;
        storedItem.price = storedItem.item.price * storedItem.qty;
    }

    this.generateArray = function() {
        var arr = [];
        for (var id in this.items) {
            arr.push(this.items[id])
        }
        return arr
    }

    this.remove = function(id) {
        delete this.items[id]
        this.totalQty--
    }
}
module.exports = function Cart(oldCart) {
    this.items = oldCart.items || {};
    this.items.qty = oldCart.items.qty || 0;

    this.add = function(item, id, qty) {
        var storedItem = this.items[id]
        if(!storedItem) {
            storedItem = this.items[id] = {item: item, qty: 0}
        }
        storedItem.qty += qty;
    }

    this.generateArray = function() {
        var arr = [];
        for (var id in this.items) {
            arr.push(this.items[id])
        }
        return arr
    }
}
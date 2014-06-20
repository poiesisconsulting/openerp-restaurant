from openerp.osv import osv, fields


class res_users(osv.osv):
    _inherit = 'res.users'
    _columns = {
        'pos_pin': fields.integer('PIN Code', help="Pin for POS Sessions", size=4)
    }

    def _check_unique_pin(self, cr, uid, ids, context=None):

        record = self.browse(cr, uid, ids, context=context)
        pin_codes = []

        for data in record:

            if data.pos_pin > 999:
                pin_codes = self.search(cr, uid, [('pos_pin', '=', data.pos_pin), ('id', '!=', data.id)])

                if len(pin_codes) > 0:
                    return False
                else:
                    return True
            else:
                return True

    _constraints = [(_check_unique_pin,
                     'Error: This PIN code is invalid or assigned to other user.', ['pos_pin'])]
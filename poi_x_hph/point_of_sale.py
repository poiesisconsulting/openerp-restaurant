# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
#    Copyright (C) 2011-2013 Serpent Consulting Services Pvt. Ltd. (<http://serpentcs.com>).
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################

from openerp.osv import fields, osv
from openerp.tools.translate import _

class pos_order(osv.osv):

    _inherit = 'pos.order'

    def _calc_lines(self, cr, uid, ids, field_names, arg=None, context=None):

        res = {}

        for order in self.browse(cr, uid, ids, context=context):
            res_order = {}
            disc=0.0
            for line in order.lines:
                if line.discount > disc:
                    disc = line.discount

            count=0
            for reject in order.lines_rejected:
                count += 1

            sp = 0
            data_obj = self.pool.get('ir.model.data')
            dummy, sp_id = data_obj.get_object_reference(cr, uid, 'poi_pos_table_designer', 'journal_sp')
            for payment in order.statement_ids:
                if payment.journal_id:
                    if payment.journal_id.id==sp_id:
                        sp += 1

            open_prod = 0

            for line in order.lines:
                if line.product_id.product_tmpl_id.list_price == 0 and line.price_unit > 0:
                    open_prod += 1

            res_order['count_rejects'] = count
            res_order['max_discount'] = disc
            res_order['sp_count'] = sp
            res_order['open_prod'] = open_prod
            res[order.id] = res_order

        return res

    _columns = {
        'count_rejects': fields.function(_calc_lines, multi="line_calc", type='integer', string='Rejected Void Count'),
        'max_discount': fields.function(_calc_lines, multi="line_calc", type='float', string='Top Discount'),
        'sp_count': fields.function(_calc_lines, multi="line_calc", type='integer', string='S&P Payments'),
        'open_prod': fields.function(_calc_lines, multi="line_calc", type='integer', string='Open Products'),
    }

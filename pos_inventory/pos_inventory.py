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
from openerp import netsvc


class pos_order(osv.osv):
    _inherit = "pos.order"

    def create_picking(self, cr, uid, ids, context=None):
        """Create a picking for each order and validate it."""
        picking_obj = self.pool.get('stock.picking')
        partner_obj = self.pool.get('res.partner')
        move_obj = self.pool.get('stock.move')
        procurement_obj = self.pool.get('procurement.order')

        for order in self.browse(cr, uid, ids, context=context):
            if not order.state == 'draft':
                continue
            addr = order.partner_id and partner_obj.address_get(cr, uid, [order.partner_id.id], ['delivery']) or {}
            picking_id = picking_obj.create(cr, uid, {
                'origin': order.name,
                'partner_id': addr.get('delivery', False),
                'type': 'out',
                'company_id': order.company_id.id,
                'move_type': 'direct',
                'note': order.note or "",
                'invoice_state': 'none',
                'auto_picking': True,
            }, context=context)

            self.write(cr, uid, [order.id], {'picking_id': picking_id}, context=context)
            location_id = order.warehouse_id.lot_stock_id.id
            output_id = order.warehouse_id.lot_output_id.id
            proc_ids = []

            for line in order.lines:
                if line.product_id and line.product_id.type == 'service':
                    continue
                if line.qty < 0:
                    location_id, output_id = output_id, location_id

                move_id = move_obj.create(cr, uid, {
                    'name': line.name,
                    'product_uom': line.product_id.uom_id.id,
                    'product_uos': line.product_id.uom_id.id,
                    'picking_id': picking_id,
                    'product_id': line.product_id.id,
                    'product_uos_qty': abs(line.qty),
                    'product_qty': abs(line.qty),
                    'tracking_id': False,
                    'state': 'draft',
                    'location_id': location_id,
                    'location_dest_id': output_id,
                }, context=context)
                if line.qty < 0:
                    location_id, output_id = output_id, location_id
                proc_id = procurement_obj.create(cr, uid,
                                                 self._prepare_order_line_procurement(cr, uid, order, line, move_id,
                                                                                      order.date_order,
                                                                                      context=context))
                proc_ids.append(proc_id)

                prod_prod_prop_rel = self.pool.get('product.product.property.rel')

                for product in line.product_ids:
                    prod_obj = product.product_id

                    prod_prop_id = prod_prod_prop_rel.search(cr, uid, [('product_id', '=', product.product_id.id),
                                                                       ('property_id', '=', product.property_id.id)])
                    prod_prop = prod_prod_prop_rel.browse(cr, uid, prod_prop_id[0])

                    move_id = move_obj.create(cr, uid, {
                        'name': prod_obj.name,
                        'product_uom': prod_obj.uom_id.id,
                        'product_uos': prod_obj.uom_id.id,
                        'picking_id': picking_id,
                        'product_id': prod_obj.id,
                        'product_uos_qty': prod_prop.quantity,
                        'product_qty': prod_prop.quantity,
                        'tracking_id': False,
                        'state': 'draft',
                        'location_id': location_id,
                        'location_dest_id': output_id,
                    }, context=context)
                    vals = {
                        'name': prod_obj.name,
                        'origin': order.name,
                        'date_planned': order.date_order,
                        'product_id': prod_obj.id,
                        'product_qty': 1,
                        'product_uom': prod_obj.uom_id.id,
                        'product_uos_qty': 1,
                        'product_uos': prod_obj.uom_id.id,
                        'location_id': order.warehouse_id.lot_stock_id.id,
                        'procure_method': prod_obj.procure_method,
                        'move_id': move_id,
                        'company_id': order.company_id.id,
                    }
                    proc_id = procurement_obj.create(cr, uid, vals, context=context)
                    proc_ids.append(proc_id)

                picking_obj.signal_button_confirm(cr, uid, [picking_id])
                picking_obj.force_assign(cr, uid, [picking_id], context)
            return True

    def _prepare_order_line_procurement(self, cr, uid, order, line, move_id, date_planned, context=None):
        return {
            'name': line.name,
            'origin': order.name,
            'date_planned': date_planned,
            'product_id': line.product_id.id,
            'product_qty': line.qty,
            'product_uom': line.product_id.uom_id.id,
            'product_uos_qty': line.qty,
            'product_uos': line.product_id.uom_id.id,
            'location_id': order.warehouse_id.lot_stock_id.id,
            'procure_method': line.product_id.procure_method,
            'move_id': move_id,
            'company_id': order.company_id.id,
        }

pos_order()

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
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
import time
from openerp import netsvc, tools
from openerp.tools.translate import _

class waiting_queue(osv.osv):
    _name = "waiting.queue"

    _order = 'sequence'

    _columns = {
        'partner_id':fields.many2one("res.partner", "Partner"),
        'no_of_people':fields.integer('NO Of Person'),
        'reservation_date':fields.datetime("Reservation Date", required=True),
        'state':fields.selection([('waiting','Waiting'),('allow','Allowed'),('left','Left')], "State"),
        'sequence':fields.char('Sequence', required=True, readonly=True),
        'table_ids': fields.many2many('table.table', 'table_queue_rel', 'table_id', 'table_queue_id', 'Tables', readonly=True),
    }

    _defaults = {
        'reservation_date':lambda *a: time.strftime("%Y-%m-%d %H:%M:%S"),
        'state':'waiting',
        'no_of_people':1,
        'sequence': '/',
    }

    def create(self, cr, uid, vals, context=None):
        if not vals.get('sequence'):
            vals.update({'sequence': self.pool.get('ir.sequence').get(cr, uid, 'waiting.queue')})
        return super(waiting_queue, self).create(cr, uid, vals, context=context)

#    def change_state_allow(self, cr, uid, ids, context=None):
#        self.write(cr, uid, ids, {'state':'allow'}, context=context)

    def change_state_left(self, cr, uid, ids, context=None):
        self.write(cr, uid, ids, {'state':'left'}, context=context)

waiting_queue()
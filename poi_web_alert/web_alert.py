# -*- coding: utf-8 -*-
##############################################################################
#
#    Poiesis Consulting, OpenERP Partner
#    Copyright (C) 2014 Poiesis Consulting (<http://www.poiesisconsulting.com>). All Rights Reserved.
#
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see http://www.gnu.org/licenses/.
#
##############################################################################

from openerp.osv import osv, fields
from openerp import SUPERUSER_ID

class web_alert(osv.osv):
    _name = 'web.alert'

    _columns = {
        'message': fields.text('Message'),
        'to': fields.many2one('res.users', 'User'),
        'relevance': fields.selection([('alert','alert'),
                                       ('information','information'),
                                       ('error','error'),
                                       ('warning','warning'),
                                       ('notification','notification'),
                                       ('success','success')],'Relevance'),
        'displayed': fields.boolean('Displayed'),
        'read': fields.boolean('Read'),
        'noty_id': fields.char('Noty ID', size=40),
        'time_programmed': fields.datetime('Time programmed')
    }

    _defaults = {
        'displayed': False,
        'read': False,
    }

    def send_alert(self, cr, uid, users, message, relevance='information'):
        """

        :param cr: Database cursor
        :param uid: User who called the function
        :param users: List of users that are going to receive the message
        :param message: Message
        """
        users_pool = self.pool.get('res.users')

        for user in users_pool.browse(cr, uid, users):
            self.create(cr, SUPERUSER_ID, {'message': message,
                                  'to': user.id,
                                  'relevance': relevance,
                                  'displayed': False,
                                  'read': False})